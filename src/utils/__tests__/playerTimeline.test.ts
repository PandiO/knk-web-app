import {
    auditCategory,
    auditToTimelineEvent,
    ledgerToTimelineEvent,
    TimelineEvent,
    TimelineMerger,
    TimelineSource,
} from '../playerTimeline';
import { AuditLogEntryDto } from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { LedgerLineDto } from '../../types/dtos/currency/CurrencyDtos';

// PandiO/knk-workspace#119 (MOD-3): the per-player timeline merges the audit log and the balance ledger.

const audit = (id: number, timestamp: string, action: AuditLogEntryDto['action'] = 'GroupAssigned', extra: Partial<AuditLogEntryDto> = {}): AuditLogEntryDto =>
    ({ id, timestamp, action, targetUserId: 3, actorUsername: 'Mod', ...extra });

const ledger = (entryId: number, createdAt: string, extra: Partial<LedgerLineDto> = {}): LedgerLineDto => ({
    entryId, transactionId: entryId, publicId: `tx-${entryId}`, createdAt, userId: 3, currency: 'Coins', operation: 'Add',
    amount: 500, balanceBefore: 100, balanceAfter: 600, kind: 'AdminGrant', reasonCode: 'COMPENSATION', reason: 'Lost items',
    initiator: 'Admin', initiatorUsername: 'Mod', ...extra,
});

/** A source over a fixed newest-first list, paged like the API (offset pages, totalCount). */
const fixed = (id: 'audit' | 'ledger', events: TimelineEvent[], calls: number[] = []): TimelineSource => ({
    id,
    fetchPage: async (page, pageSize) => {
        calls.push(page);
        return { events: events.slice((page - 1) * pageSize, page * pageSize), totalCount: events.length };
    },
});

describe('playerTimeline mapping', () => {
    it('maps an audit entry with its label, details, category and tone', () => {
        const e = auditToTimelineEvent(audit(7, '2026-11-08T10:00:00', 'PlayerFrozen', { details: '{"reason":"Griefing"}' }));
        expect(e).toMatchObject({
            key: 'audit:7', source: 'audit', category: 'moderation', title: 'Player frozen', actor: 'Mod', tone: 'danger',
            lines: ['Reason: Griefing'],
        });
        // The API sends UTC without a zone; it is read as UTC.
        expect(e.atMs).toBe(Date.UTC(2026, 10, 8, 10, 0, 0));
        expect(auditToTimelineEvent(audit(8, '2026-11-08T10:00:00', 'PlayerUnfrozen')).tone).toBe('success');
        expect(auditToTimelineEvent(audit(9, '2026-11-08T10:00:00', 'PlayerFrozen', { actorUsername: null })).actor).toBeNull();
    });

    it('sorts every action into a category, unknown ones under Account', () => {
        expect(auditCategory('BalanceAdjusted')).toBe('economy');
        expect(auditCategory('GrantRemoved')).toBe('permissions');
        expect(auditCategory('TitleChanged')).toBe('progress');
        expect(auditCategory('MinecraftLinked')).toBe('account');
        expect(auditCategory('SomethingNew')).toBe('account');
    });

    it('maps a ledger line with the signed amount, the reason, the balances and the transaction', () => {
        const e = ledgerToTimelineEvent(ledger(4, '2026-11-08T09:00:00'));
        expect(e).toMatchObject({ key: 'ledger:4', source: 'ledger', category: 'economy', title: '+500 coins', actor: 'Mod' });
        expect(e.lines).toEqual(['Lost items', '100 → 600 coins', 'AdminGrant · COMPENSATION', 'Transaction tx-4']);
        expect(ledgerToTimelineEvent(ledger(5, '2026-11-08T09:00:00', { amount: -20, currency: 'Gems', balanceBefore: 30, balanceAfter: 10,
            kind: 'Transfer', reasonCode: '', counterpartyUsername: 'Alex', initiator: 'Player', initiatorUsername: null })))
            .toMatchObject({ title: '−20 gems', actor: null, lines: ['Lost items', '30 → 10 gems', 'Transfer', 'To Alex', 'Transaction tx-5'] });
        expect(ledgerToTimelineEvent(ledger(6, '2026-11-08T09:00:00', { operation: 'Set', balanceAfter: 1000, initiator: 'PluginService', initiatorUsername: null })))
            .toMatchObject({ title: 'Balance set: 1,000 coins', actor: 'Game server' });
        expect(ledgerToTimelineEvent(ledger(7, '2026-11-08T09:00:00', { reversesTransactionId: 3 })).tags).toEqual([{ label: 'Reversal', tone: 'gray' }]);
    });

    it('survives a line or an entry with missing fields', () => {
        expect(() => ledgerToTimelineEvent({ entryId: 1 } as LedgerLineDto)).not.toThrow();
        expect(ledgerToTimelineEvent({ entryId: 1 } as LedgerLineDto).atMs).toBe(0);
        expect(() => auditToTimelineEvent({ id: 1 } as AuditLogEntryDto)).not.toThrow();
    });
});

describe('TimelineMerger', () => {
    const at = (h: number) => `2026-11-08T${String(h).padStart(2, '0')}:00:00`;

    it('merges two sources newest first, page by page, never showing an older row above a newer one', async () => {
        const auditCalls: number[] = [];
        const ledgerCalls: number[] = [];
        const auditEvents = [20, 18, 17, 16, 15, 3].map((h, i) => auditToTimelineEvent(audit(i + 1, at(h))));
        const ledgerEvents = [19, 14, 13, 2, 1].map((h, i) => ledgerToTimelineEvent(ledger(i + 1, at(h))));
        const merger = new TimelineMerger([fixed('audit', auditEvents, auditCalls), fixed('ledger', ledgerEvents, ledgerCalls)], 2);

        const first = await merger.next(4);
        expect(first.map(e => e.key)).toEqual(['audit:1', 'ledger:1', 'audit:2', 'audit:3']);
        expect(merger.hasMore).toBe(true);

        const rest = await merger.next(100);
        expect(rest.map(e => e.key)).toEqual(['audit:4', 'audit:5', 'ledger:2', 'ledger:3', 'audit:6', 'ledger:4', 'ledger:5']);
        expect(merger.hasMore).toBe(false);
        expect(await merger.next(5)).toEqual([]);
        expect(merger.totalCount).toBe(11);
        // Pages are read only when needed, one at a time per source.
        expect(auditCalls).toEqual([1, 2, 3]);
        expect(ledgerCalls).toEqual([1, 2, 3]);
    });

    it('shows a row once when a new row shifted the offset pages', async () => {
        let call = 0;
        const source: TimelineSource = {
            id: 'audit',
            fetchPage: async page => {
                call += 1;
                // Page 2 repeats id 2 (a new entry arrived between the reads).
                const pages = [[audit(3, at(12)), audit(2, at(11))], [audit(2, at(11)), audit(1, at(10))]];
                return { events: (pages[page - 1] ?? []).map(auditToTimelineEvent), totalCount: 4 };
            },
        };
        const merger = new TimelineMerger([source], 2);
        const all = [...await merger.next(2), ...await merger.next(10)];
        expect(all.map(e => e.key)).toEqual(['audit:3', 'audit:2', 'audit:1']);
        expect(call).toBe(2);
    });

    it('goes on without a source that fails, and names it', async () => {
        const failing: TimelineSource = { id: 'ledger', fetchPage: () => Promise.reject(new Error('403')) };
        const merger = new TimelineMerger([fixed('audit', [auditToTimelineEvent(audit(1, at(9)))]), failing], 25);
        expect((await merger.next(25)).map(e => e.key)).toEqual(['audit:1']);
        expect(merger.errors.map(e => e.id)).toEqual(['ledger']);
        expect(merger.hasMore).toBe(false);
    });

    it('ends on an empty source and on a page without rows', async () => {
        const empty: TimelineSource = { id: 'audit', fetchPage: async () => ({ events: [], totalCount: 7 }) };
        const merger = new TimelineMerger([empty], 25);
        expect(await merger.next(25)).toEqual([]);
        expect(merger.hasMore).toBe(false);
    });
});
