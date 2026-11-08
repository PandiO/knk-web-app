import { AuditAction, AuditLogEntryDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';
import { LedgerLineDto } from '../types/dtos/currency/CurrencyDtos';
import { auditActionLabel, auditTags, describeAuditDetails } from './auditDetails';
import { formatNumber, parseApiDate } from './format';

/**
 * PandiO/knk-workspace#119 (MOD-3): one player's timeline on the profile, newest first, merged in the browser from
 * the paged sources the API has today:
 *
 * - the **audit log** about the player (`GET api/audit-log?targetUserId=`; moderation, permissions, titles, kits…),
 * - the **balance ledger** of the player (`GET api/currency/admin/ledger?userId=`, with knk.admin.currency.history).
 *
 * Game sessions have no read endpoint yet, so they are not in it (an API need of the issue). Each source is read a
 * page at a time; an event is only shown once every source that still has rows has one at least as old, so
 * "Load older" never puts an older row above a newer one. A row seen twice (new rows shift the offset pages) is
 * shown once.
 */

export type TimelineCategory = 'moderation' | 'economy' | 'permissions' | 'progress' | 'account';

export const TIMELINE_CATEGORIES: { key: TimelineCategory; label: string }[] = [
    { key: 'moderation', label: 'Moderation' },
    { key: 'economy', label: 'Economy' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'progress', label: 'Progress' },
    { key: 'account', label: 'Account' },
];

export type TimelineSourceId = 'audit' | 'ledger';

export interface TimelineEvent {
    /** Unique over all sources (`audit:12`, `ledger:34`). */
    key: string;
    source: TimelineSourceId;
    /** Epoch ms; NaN-free (unreadable dates sort last as 0). */
    atMs: number;
    /** The source's own timestamp text, for display. */
    at: string;
    category: TimelineCategory;
    title: string;
    /** Who did it: a name, or null for the system / the game server. */
    actor: string | null;
    lines: string[];
    tags: { label: string; tone: 'red' | 'gray' }[];
    tone: 'danger' | 'success' | 'neutral';
}

const AUDIT_CATEGORY: Partial<Record<AuditAction, TimelineCategory>> = {
    PlayerFrozen: 'moderation',
    PlayerUnfrozen: 'moderation',
    VanishToggled: 'moderation',
    PlayerTeleported: 'moderation',
    PlayerAdmitted: 'moderation',
    CurrencyTransferLocked: 'moderation',
    CurrencyTransferUnlocked: 'moderation',
    PrivateMessagesViewed: 'moderation',
    TelemetryViewed: 'moderation',
    BalanceAdjusted: 'economy',
    SalaryPayout: 'economy',
    CurrencyTransactionReversed: 'economy',
    CurrencyPolicyChanged: 'economy',
    KitGranted: 'economy',
    LootboxGranted: 'economy',
    LootboxSpawnedByAdmin: 'economy',
    GroupAssigned: 'permissions',
    GroupRemoved: 'permissions',
    GrantAdded: 'permissions',
    GrantUpdated: 'permissions',
    GrantRemoved: 'permissions',
    TitleChanged: 'progress',
    DiscoveryReset: 'progress',
};

export const auditCategory = (action: AuditAction | string): TimelineCategory =>
    AUDIT_CATEGORY[action as AuditAction] ?? 'account';

const DANGER_ACTIONS = new Set<string>(['PlayerFrozen', 'CurrencyTransferLocked', 'GroupRemoved', 'GrantRemoved',
    'PrivacyDeletionRequested', 'PrivacyDeletionExecuted', 'MinecraftUnlinked']);
const SUCCESS_ACTIONS = new Set<string>(['PlayerUnfrozen', 'CurrencyTransferUnlocked', 'PlayerAdmitted']);

const epoch = (value: string | null | undefined): number => parseApiDate(value)?.getTime() ?? 0;

export function auditToTimelineEvent(entry: AuditLogEntryDto): TimelineEvent {
    return {
        key: `audit:${entry.id}`,
        source: 'audit',
        atMs: epoch(entry.timestamp),
        at: entry.timestamp,
        category: auditCategory(entry.action),
        title: auditActionLabel(entry),
        actor: entry.actorUsername ?? null,
        lines: describeAuditDetails(entry),
        tags: auditTags(entry).map(tag => ({ label: tag.label, tone: tag.tone === 'red' ? 'red' : 'gray' })),
        tone: DANGER_ACTIONS.has(entry.action) ? 'danger' : SUCCESS_ACTIONS.has(entry.action) ? 'success' : 'neutral',
    };
}

const CURRENCY_LABEL: Record<string, string> = { Coins: 'coins', Gems: 'gems', Experience: 'XP' };

const signed = (amount: number): string => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${formatNumber(Math.abs(amount))}`;

/** One ledger line: "+500 coins" with the reason, the kind and who started it. */
export function ledgerToTimelineEvent(line: LedgerLineDto): TimelineEvent {
    const currency = CURRENCY_LABEL[line.currency] ?? String(line.currency ?? '').toLowerCase();
    const amount = Number(line.amount) || 0;
    const title = line.operation === 'Set'
        ? `Balance set: ${formatNumber(Number(line.balanceAfter) || 0)} ${currency}`
        : `${signed(amount)} ${currency}`;
    const lines: string[] = [];
    if (line.reason) lines.push(line.reason);
    lines.push(`${formatNumber(Number(line.balanceBefore) || 0)} → ${formatNumber(Number(line.balanceAfter) || 0)} ${currency}`);
    const kind = [line.kind, line.reasonCode].filter(Boolean).join(' · ');
    if (kind) lines.push(kind);
    if (line.counterpartyUsername) lines.push(`${amount < 0 ? 'To' : 'From'} ${line.counterpartyUsername}`);
    if (line.publicId) lines.push(`Transaction ${line.publicId}`);
    const actor = line.initiatorUsername
        ?? (line.initiator === 'PluginService' ? 'Game server' : line.initiatorComponent ?? null);
    return {
        key: `ledger:${line.entryId}`,
        source: 'ledger',
        atMs: epoch(line.createdAt),
        at: line.createdAt,
        category: 'economy',
        title,
        actor,
        lines,
        tags: line.reversesTransactionId ? [{ label: 'Reversal', tone: 'gray' }] : [],
        tone: 'neutral',
    };
}

export interface TimelinePage {
    events: TimelineEvent[];
    totalCount: number;
}

export interface TimelineSource {
    id: TimelineSourceId;
    /** 1-based page, newest first. */
    fetchPage: (page: number, pageSize: number) => Promise<TimelinePage>;
}

interface SourceState {
    source: TimelineSource;
    nextPage: number;
    buffer: TimelineEvent[];
    done: boolean;
    total: number;
    error: unknown;
}

const newerFirst = (a: TimelineEvent, b: TimelineEvent): number =>
    b.atMs - a.atMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * Merges the sources' newest-first pages into one newest-first list, a batch at a time (`next`). A source that
 * fails is left out from then on (`errors` names it); the others go on.
 */
export class TimelineMerger {
    private readonly states: SourceState[];
    private readonly seen = new Set<string>();

    constructor(sources: TimelineSource[], private readonly pageSize = 25) {
        this.states = sources.map(source => ({ source, nextPage: 1, buffer: [], done: false, total: 0, error: null }));
    }

    private async fill(state: SourceState): Promise<void> {
        try {
            const page = await state.source.fetchPage(state.nextPage, this.pageSize);
            const events = (page?.events ?? []).filter(e => !this.seen.has(e.key)).sort(newerFirst);
            const received = page?.events?.length ?? 0;
            state.total = Number(page?.totalCount) || 0;
            state.nextPage += 1;
            state.buffer.push(...events);
            if (received === 0 || (state.nextPage - 1) * this.pageSize >= state.total) state.done = true;
        } catch (error) {
            state.error = error;
            state.done = true;
            state.buffer = [];
        }
    }

    /** Up to `count` more events, newest first. Fewer (or none) when every source is done. */
    async next(count: number): Promise<TimelineEvent[]> {
        const out: TimelineEvent[] = [];
        while (out.length < count) {
            // Every source that still has rows needs one in hand before anything older may be shown.
            // A page whose rows were all seen already leaves the buffer empty: read on until rows or the end.
            let empty = this.states.filter(s => !s.done && s.buffer.length === 0);
            while (empty.length > 0) {
                await Promise.all(empty.map(s => this.fill(s)));
                empty = this.states.filter(s => !s.done && s.buffer.length === 0);
            }
            const live = this.states.filter(s => s.buffer.length > 0);
            if (live.length === 0) break;
            const best = live.reduce((a, b) => (newerFirst(a.buffer[0], b.buffer[0]) <= 0 ? a : b));
            const event = best.buffer.shift()!;
            if (this.seen.has(event.key)) continue;
            this.seen.add(event.key);
            out.push(event);
        }
        return out;
    }

    get hasMore(): boolean {
        return this.states.some(s => !s.done || s.buffer.length > 0);
    }

    /** The sources that failed, with their error. */
    get errors(): { id: TimelineSourceId; error: unknown }[] {
        return this.states.filter(s => s.error != null).map(s => ({ id: s.source.id, error: s.error }));
    }

    /** The sum of the sources' totals (what the API counted when last read). */
    get totalCount(): number {
        return this.states.reduce((sum, s) => sum + (s.error ? 0 : s.total), 0);
    }
}
