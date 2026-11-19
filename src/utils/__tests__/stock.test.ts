import {
    capacityText,
    enumLabel,
    isLockedNow,
    isOverCap,
    ledgerQuery,
    ledgerSearch,
    lineMovesPath,
    newIdempotencyKey,
    readLedgerState,
    rejectReasonText,
    rejectedLines,
    signedAmount,
    stockRefusalReason,
    stockResultSummary,
    toUtcInstant,
} from '../stock';
import { StockResultDto } from '../../types/dtos/stock/StockDtos';

/** Stock core P1 in the web app (PandiO/knk-workspace#675): labels, result texts, the ledger explorer's filters. */
describe('stock utils', () => {
    it('spells enum values as words', () => {
        expect(enumLabel('AdminAdjust')).toBe('Admin adjust');
        expect(enumLabel('PartiallyApplied')).toBe('Partially applied');
        expect(enumLabel(null)).toBe('-');
    });

    it('explains each reject reason and leaves None empty', () => {
        expect(rejectReasonText('CapacityFull')).toMatch(/^Capacity full: the storage is full/);
        expect(rejectReasonText('NotEnoughStock')).toBe('Not enough stock: not enough stock in the source');
        expect(rejectReasonText('Locked')).toBe('Locked: a storage is locked');
        expect(rejectReasonText('OtherLineRejected')).toMatch(/another line/);
        expect(rejectReasonText('None')).toBe('');
        expect(rejectReasonText('SomethingNew')).toBe('Something new');
    });

    it('sums up a result: applied, partly applied, rejected and replayed', () => {
        const partial: StockResultDto = {
            status: 'PartiallyApplied', transactionId: 9, replayed: false, accepted: 18,
            lines: [{ lineNo: 1, fromStorageId: 1, toStorageId: 2, itemBlueprintId: 3, requested: 40, accepted: 18, rejected: 22, rejectReason: 'CapacityFull' }],
        };
        expect(stockResultSummary(partial)).toBe('Partially applied (transaction #9): 18 moved, the rest refused.');
        expect(rejectedLines(partial)).toHaveLength(1);
        expect(stockResultSummary({ ...partial, status: 'Rejected', transactionId: null, accepted: 0 })).toBe('Rejected: nothing moved and no transaction was written.');
        expect(stockResultSummary({ ...partial, status: 'Applied', accepted: 2, replayed: true, lines: [] }))
            .toMatch(/^Applied \(transaction #9\): 2 moved\. This key was used before/);
    });

    it("reads the stock endpoints' { error } bodies and the idempotency key refusal", () => {
        expect(stockRefusalReason({ status: 400, response: { error: 'A note is required.' } })).toBe('A note is required.');
        expect(stockRefusalReason({ status: 409, response: { code: 'IdempotencyKeyReuse', error: 'Key used.' } }))
            .toMatch(/already used for a different request \(Key used\.\)/);
        expect(stockRefusalReason({ status: 403, message: 'HTTP 403: Forbidden' })).toBe("You don't have permission to do this.");
        expect(stockRefusalReason({ status: 500, response: { error: 'boom' } })).toBeUndefined();
    });

    it('makes a different idempotency key each time', () => {
        const a = newIdempotencyKey('adjust');
        expect(a).toMatch(/^adjust-/);
        expect(newIdempotencyKey('adjust')).not.toBe(a);
    });

    it('describes capacity in raw units and spots a storage over its cap', () => {
        expect(capacityText({ capacityUsed: 60, maxUnits: 100 })).toBe('60 of 100 raw units (60 %)');
        expect(capacityText({ capacityUsed: 12.5, maxUnits: null })).toBe('12.5 raw units; no cap');
        expect(isOverCap({ capacityUsed: 120, maxUnits: 100, distinctItems: 1, maxDistinct: null })).toBe(true);
        expect(isOverCap({ capacityUsed: 10, maxUnits: 100, distinctItems: 3, maxDistinct: 2 })).toBe(true);
        expect(isOverCap({ capacityUsed: 10, maxUnits: 100, distinctItems: 1, maxDistinct: 2 })).toBe(false);
    });

    it("trusts the API's isLocked, else compares lockedUntil with now", () => {
        const now = new Date('2026-11-19T12:00:00Z');
        expect(isLockedNow({ isLocked: false, lockedUntil: '2026-11-19T13:00:00Z' }, now)).toBe(false);
        expect(isLockedNow({ lockedUntil: '2026-11-19T13:00:00Z' }, now)).toBe(true);
        expect(isLockedNow({ lockedUntil: '2026-11-19T11:00:00Z' }, now)).toBe(false);
    });

    it('keeps the explorer state in the address and drops bad ids', () => {
        const state = readLedgerState(new URLSearchParams('view=moves&storageId=12&itemBlueprintId=x&reason=Production&page=3'));
        expect(state).toEqual({ view: 'moves', filters: { storageId: '12', reason: 'Production' }, page: 3 });
        expect(ledgerSearch(state)).toBe('?view=moves&storageId=12&reason=Production&page=3');
        expect(readLedgerState(new URLSearchParams('view=nope')).view).toBe('transactions');
        expect(ledgerSearch({ view: 'transactions', filters: {}, page: 1 })).toBe('');
        expect(lineMovesPath(12, 3)).toBe('/admin/stock/ledger?view=moves&storageId=12&itemBlueprintId=3');
    });

    it('sends only the filters a list reads, with dates as UTC instants', () => {
        const query = ledgerQuery({ view: 'rollups', filters: { storageId: '12', sourceType: 'Order', since: '2026-11-01' }, page: 2 }, 50);
        expect(query.pageNumber).toBe(2);
        expect(query.pageSize).toBe(50);
        expect(query.sortDescending).toBe(true);
        expect(Object.keys(query.filters ?? {})).toEqual(['storageId', 'since']);
        expect(query.filters?.since).toBe(new Date('2026-11-01T00:00').toISOString());
        expect(toUtcInstant('2026-11-01', true)).toBe(new Date('2026-11-02T00:00').toISOString());
        expect(toUtcInstant('nonsense')).toBeNull();
    });

    it('signs a move from one storage: + in, − out', () => {
        const move = { fromStorageId: 1, toStorageId: 2, amount: 5 };
        expect(signedAmount(move, 2)).toBe(5);
        expect(signedAmount(move, 1)).toBe(-5);
        expect(signedAmount(move, 3)).toBe(0);
        expect(signedAmount(move, null)).toBe(5);
    });
});
