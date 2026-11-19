import {
    StockLineResultDto,
    StockPagedQueryDto,
    StockReason,
    StockRejectReason,
    StockResultDto,
    StorageDto,
} from '../types/dtos/stock/StockDtos';
import { apiRefusalReason } from './apiRefusalReason';
import { formatNumber } from './format';

// Stock core P1 in the web app (PandiO/knk-workspace#675; production DESIGN § 4): labels, result texts, the ledger
// explorer's filters (kept in the page's address so a drill-down link opens the right moves), and helpers for the
// adjust and move dialogs.

/** Spaced words for an enum value: `AdminAdjust` → "Admin adjust", `PartiallyApplied` → "Partially applied". */
export function enumLabel(value: string | null | undefined): string {
    if (!value) return '-';
    const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

const REJECT_TEXT: Record<StockRejectReason, string> = {
    None: '',
    CapacityFull: 'the storage is full (capacity in raw units × storage weight)',
    DistinctCapReached: 'the storage holds its maximum number of distinct items',
    NotEnoughStock: 'not enough stock in the source',
    Locked: 'a storage is locked',
    OtherLineRejected: 'another line of this all-or-nothing request was refused',
};

/** Why (part of) a line was not moved, as staff read it ("Capacity full: the storage is full ..."). */
export function rejectReasonText(reason: StockRejectReason | string | null | undefined): string {
    if (!reason || reason === 'None') return '';
    const text = REJECT_TEXT[reason as StockRejectReason];
    return text ? `${enumLabel(reason)}: ${text}` : enumLabel(reason);
}

/** The one-line outcome of a stock request; a refusal is a result (200), not an error. */
export function stockResultSummary(result: StockResultDto): string {
    const tx = result.transactionId != null ? ` (transaction #${result.transactionId})` : '';
    const replayed = result.replayed ? ' This key was used before: the first result is shown and nothing moved again.' : '';
    switch (result.status) {
        case 'Applied':
            return `Applied${tx}: ${formatNumber(result.accepted)} moved.${replayed}`;
        case 'PartiallyApplied':
            return `Partially applied${tx}: ${formatNumber(result.accepted)} moved, the rest refused.${replayed}`;
        case 'Rejected':
            return 'Rejected: nothing moved and no transaction was written.';
        default:
            return enumLabel(result.status);
    }
}

/** The lines of a result that were (partly) refused. */
export function rejectedLines(result: StockResultDto): StockLineResultDto[] {
    return (result.lines ?? []).filter(line => line.rejected > 0 || (line.rejectReason && line.rejectReason !== 'None'));
}

/**
 * The API's explanation of a refused stock request. Stock endpoints answer `{ error }` (400, 404, 409) and a reused
 * idempotency key `{ code: "IdempotencyKeyReuse", error }`, which the app-wide reader does not pick up.
 */
export function stockRefusalReason(error: unknown): string | undefined {
    const e = error as { status?: number; response?: unknown } | null;
    const body = e?.response as { error?: unknown; code?: unknown } | null | undefined;
    if (e?.status && e.status >= 400 && e.status < 500 && body && typeof body === 'object') {
        const text = typeof body.error === 'string' ? body.error.trim() : '';
        if (body.code === 'IdempotencyKeyReuse') {
            return `This request's key was already used for a different request${text ? ` (${text})` : ''}. Close the dialog and start again.`;
        }
        if (text) return text;
    }
    return apiRefusalReason(error);
}

/** A fresh idempotency key for one dialog: a retry of the same request (a double click, a lost answer) applies once. */
export function newIdempotencyKey(prefix = 'web'): string {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}-${random}`;
}

/** The capacity line of a storage page: "60 of 100 raw units (60 %)", or "No cap" without `maxUnits`. */
export function capacityText(storage: Pick<StorageDto, 'capacityUsed' | 'maxUnits'>): string {
    const used = storage.capacityUsed ?? 0;
    if (storage.maxUnits == null) return `${formatNumber(used)} raw units; no cap`;
    const pct = storage.maxUnits > 0 ? Math.round((used / storage.maxUnits) * 100) : 0;
    return `${formatNumber(used)} of ${formatNumber(storage.maxUnits)} raw units (${pct} %)`;
}

/** Over its cap after a cap was lowered (DESIGN § 4.4: removals only, nothing trimmed). */
export function isOverCap(storage: Pick<StorageDto, 'capacityUsed' | 'maxUnits' | 'distinctItems' | 'maxDistinct'>): boolean {
    const overUnits = storage.maxUnits != null && (storage.capacityUsed ?? 0) > storage.maxUnits;
    const overDistinct = storage.maxDistinct != null && (storage.distinctItems ?? 0) > storage.maxDistinct;
    return overUnits || overDistinct;
}

/** Whether a storage is locked now: the API's `isLocked`, else a `lockedUntil` in the future. */
export function isLockedNow(storage: Pick<StorageDto, 'isLocked' | 'lockedUntil'>, now: Date = new Date()): boolean {
    if (storage.isLocked != null) return storage.isLocked;
    return !!storage.lockedUntil && new Date(storage.lockedUntil).getTime() > now.getTime();
}

// ---- The ledger explorer ----

export type LedgerView = 'transactions' | 'moves' | 'rollups';
export const LEDGER_VIEWS: readonly LedgerView[] = ['transactions', 'moves', 'rollups'];

/** The filters each list of the ledger explorer reads (knk-web-api `StockLedgerService`). */
export const LEDGER_FILTER_KEYS: Record<LedgerView, readonly string[]> = {
    transactions: ['storageId', 'itemBlueprintId', 'itemInstanceId', 'transactionId', 'reason', 'actorUserId', 'sourceType', 'sourceRef', 'since', 'until'],
    moves: ['storageId', 'itemBlueprintId', 'itemInstanceId', 'transactionId', 'reason', 'actorUserId', 'since', 'until'],
    rollups: ['storageId', 'itemBlueprintId', 'reason', 'since', 'until'],
};

export const ALL_LEDGER_FILTER_KEYS: readonly string[] = LEDGER_FILTER_KEYS.transactions;

export interface LedgerState {
    view: LedgerView;
    filters: Record<string, string>;
    page: number;
}

const ID_KEYS = new Set(['storageId', 'itemBlueprintId', 'itemInstanceId', 'transactionId', 'actorUserId']);

/** The explorer's state from its address: `?view=moves&storageId=12&itemBlueprintId=3&page=2`. */
export function readLedgerState(params: URLSearchParams): LedgerState {
    const view = (LEDGER_VIEWS as readonly string[]).includes(params.get('view') ?? '') ? params.get('view') as LedgerView : 'transactions';
    const filters: Record<string, string> = {};
    for (const key of ALL_LEDGER_FILTER_KEYS) {
        const value = params.get(key)?.trim();
        if (!value) continue;
        if (ID_KEYS.has(key) && !/^\d+$/.test(value)) continue;
        filters[key] = value;
    }
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
    return { view, filters, page };
}

/** The address of a state (the inverse of readLedgerState); page 1 and empty filters are left out. */
export function ledgerSearch(state: LedgerState): string {
    const params = new URLSearchParams();
    if (state.view !== 'transactions') params.set('view', state.view);
    for (const key of ALL_LEDGER_FILTER_KEYS) {
        const value = state.filters[key]?.trim();
        if (value) params.set(key, value);
    }
    if (state.page > 1) params.set('page', String(state.page));
    const query = params.toString();
    return query ? `?${query}` : '';
}

export const STOCK_LEDGER_PATH = '/admin/stock/ledger';

/** The drill-down from a stock line's number to the moves that made it (and its roll-up rows). */
export function lineMovesPath(storageId: number, itemBlueprintId: number): string {
    return `${STOCK_LEDGER_PATH}${ledgerSearch({ view: 'moves', filters: { storageId: String(storageId), itemBlueprintId: String(itemBlueprintId) }, page: 1 })}`;
}

/** The moves of one unique item (A03). */
export function itemInstanceMovesPath(itemInstanceId: number): string {
    return `${STOCK_LEDGER_PATH}${ledgerSearch({ view: 'moves', filters: { itemInstanceId: String(itemInstanceId) }, page: 1 })}`;
}

/** Every move of one blueprint, in any storage. */
export function blueprintMovesPath(itemBlueprintId: number): string {
    return `${STOCK_LEDGER_PATH}${ledgerSearch({ view: 'moves', filters: { itemBlueprintId: String(itemBlueprintId) }, page: 1 })}`;
}

/** Every transaction that touched a storage. */
export function storageLedgerPath(storageId: number): string {
    return `${STOCK_LEDGER_PATH}${ledgerSearch({ view: 'transactions', filters: { storageId: String(storageId) }, page: 1 })}`;
}

/**
 * The API query of a view: only the keys that list reads; `since` and `until` (a local date or date-time from the
 * form) become ISO UTC instants; a date-only `until` means "to the end of that day".
 */
export function ledgerQuery(state: LedgerState, pageSize: number): StockPagedQueryDto {
    const filters: Record<string, string> = {};
    for (const key of LEDGER_FILTER_KEYS[state.view]) {
        const value = state.filters[key]?.trim();
        if (!value) continue;
        if (key === 'since' || key === 'until') {
            const iso = toUtcInstant(value, key === 'until');
            if (iso) filters[key] = iso;
        } else {
            filters[key] = value;
        }
    }
    return { pageNumber: state.page, pageSize, sortDescending: true, filters };
}

/** A local `yyyy-mm-dd` or `yyyy-mm-ddThh:mm` as an ISO UTC instant; a date-only end moves to the next midnight. */
export function toUtcInstant(value: string, endOfDay = false): string | null {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = dateOnly ? new Date(`${value}T00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (dateOnly && endOfDay) date.setDate(date.getDate() + 1);
    return date.toISOString();
}

/** Signed amount of a move as seen from one storage: + into it, − out of it, unsigned without a storage. */
export function signedAmount(move: { fromStorageId: number; toStorageId: number; amount: number }, storageId?: number | null): number {
    if (storageId == null) return move.amount;
    if (move.toStorageId === storageId && move.fromStorageId !== storageId) return move.amount;
    if (move.fromStorageId === storageId && move.toStorageId !== storageId) return -move.amount;
    return 0;
}

export const reasonLabel = (reason: StockReason | string): string => enumLabel(reason);
