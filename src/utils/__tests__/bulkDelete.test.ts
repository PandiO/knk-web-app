import { countOf, pluralLabel, runBulkDelete } from '../bulkDelete';

// PandiO/knk-workspace#205 bulk delete: chunks of 100, per-row results, a failed call stops the run.
describe('runBulkDelete', () => {
    it('sends chunks in order and gathers deleted and refused rows', async () => {
        const call = jest.fn(async (ids: number[]) => ({
            deleted: ids.filter(id => id % 50 !== 0),
            refused: ids.filter(id => id % 50 === 0).map(id => ({ id, reason: 'in use', code: 'InUse' })),
        }));
        const progress = jest.fn();
        const ids = Array.from({ length: 230 }, (_, i) => i + 1);
        const outcome = await runBulkDelete(ids, call, progress);
        expect(call.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 30]);
        expect(outcome.deleted).toHaveLength(226);
        expect(outcome.refused.map(r => r.id)).toEqual([50, 100, 150, 200]);
        expect(outcome.notRun).toBeNull();
        expect(progress.mock.calls).toEqual([[100, 230], [200, 230], [230, 230]]);
    });

    it('stops at a failed call and reports the ids not tried, the rate limit in words', async () => {
        const call = jest.fn()
            .mockResolvedValueOnce({ deleted: [1, 2], refused: [] })
            .mockRejectedValueOnce(Object.assign(new Error('HTTP 429'), { status: 429 }));
        const outcome = await runBulkDelete([1, 2, 3, 4, 5], call, undefined, 2);
        expect(call).toHaveBeenCalledTimes(2);
        expect(outcome.deleted).toEqual([1, 2]);
        expect(outcome.notRun).toEqual({ ids: [3, 4, 5], reason: 'Too many bulk actions in a short time. Wait a minute and try again.' });
    });

    it('counts a row the answer forgot as refused', async () => {
        const outcome = await runBulkDelete([1, 2], async () => ({ deleted: [1], refused: [] }));
        expect(outcome.refused).toEqual([{ id: 2, reason: 'The server gave no answer for this row.', code: 'Failed' }]);
    });

    it('passes the API refusal of the whole call on', async () => {
        const outcome = await runBulkDelete([1], async () => {
            throw Object.assign(new Error('x'), { status: 400, response: { error: 'BulkDeleteNotAllowed', message: 'User records can only be deleted one at a time.' } });
        });
        expect(outcome.notRun).toEqual({ ids: [1], reason: 'User records can only be deleted one at a time.' });
    });
});

describe('countOf', () => {
    it('names the count and the type', () => {
        expect(countOf(1, 'Town')).toBe('1 Town');
        expect(countOf(1500, 'Category')).toBe('1,500 Categories');
        expect(pluralLabel('Lootbox')).toBe('Lootboxes');
        expect(pluralLabel('Siege Lobby')).toBe('Siege Lobbies');
        expect(pluralLabel('Gate Door')).toBe('Gate Doors');
    });
});
