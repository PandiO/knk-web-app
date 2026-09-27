import {
    apiErrorMessage,
    coveringBoxStars,
    emptyWindowStars,
    formatPercent,
    gradeWindow,
    perMillionToPercent,
    poolCountsByStars,
    reachableItemStars,
} from '../lootbox';

const type = (minBoxStars: number, maxBoxStars: number, itemStarSpread: number) => ({ minBoxStars, maxBoxStars, itemStarSpread });

const windowsOf = (t: ReturnType<typeof type>) => {
    const stars = new Set<number>();
    coveringBoxStars(t).forEach(b => gradeWindow(b, t.itemStarSpread).forEach(s => stars.add(s)));
    return Array.from(stars).sort((a, b) => a - b);
};

describe('lootbox helpers', () => {
    it('formats odds so tiny jackpots stay readable', () => {
        expect(formatPercent(18.75)).toBe('18.75%');
        expect(formatPercent(33.3333)).toBe('33.33%');
        expect(formatPercent(0.05)).toBe('0.05%');
        expect(formatPercent(0.199500998)).toBe('0.2%');
        expect(formatPercent(0.000123456)).toBe('0.000123%');
        expect(formatPercent(0)).toBe('0%');
        expect(perMillionToPercent(500)).toBe(0.05);
        expect(perMillionToPercent(2000)).toBe(0.2);
    });

    it('computes the item-grade window of a box grade, clamped at ★1', () => {
        expect(gradeWindow(5, 2)).toEqual([3, 4, 5]);
        expect(gradeWindow(2, 2)).toEqual([1, 2]);
        expect(gradeWindow(3, 0)).toEqual([3]);
    });

    it('covers every reachable item grade with as few odds requests as possible', () => {
        const cases = [type(1, 5, 2), type(2, 5, 2), type(1, 5, 0), type(3, 5, 1), type(5, 5, 2), type(1, 1, 2), type(4, 5, 9)];
        cases.forEach(t => expect(windowsOf(t)).toEqual(reachableItemStars(t)));
        expect(coveringBoxStars(type(1, 5, 2))).toEqual([5, 2]);
        expect(coveringBoxStars(type(5, 5, 2))).toEqual([5]);
        expect(reachableItemStars(type(2, 5, 2))).toEqual([1, 2, 3, 4, 5]);
        expect(reachableItemStars(type(4, 5, 1))).toEqual([3, 4, 5]);
    });

    it('merges pool sizes and flags reachable grades without items', () => {
        const counts = poolCountsByStars([
            { itemGrades: [{ gradeId: 3, name: 'Rare', stars: 3, percent: 50, itemCount: 3 }, { gradeId: 5, name: 'Legendary', stars: 5, percent: 50, itemCount: 1 }] },
            { itemGrades: [{ gradeId: 1, name: 'Common', stars: 1, percent: 100, itemCount: 2 }] },
        ]);
        expect(counts).toEqual({ 1: 2, 3: 3, 5: 1 });
        expect(emptyWindowStars(type(1, 5, 2), counts)).toEqual([2, 4]);
    });

    it("prefers the API's reason for a refused request", () => {
        const withStatus = (status: number, message: string, response?: unknown) =>
            Object.assign(new Error(message), { status, response });
        expect(apiErrorMessage(withStatus(400, 'HTTP 400: Bad Request', 'MaxBoxStars must be 1-5.'), 'fallback')).toBe('MaxBoxStars must be 1-5.');
        expect(apiErrorMessage(withStatus(409, 'Category taken', { code: 'CategoryTaken', message: 'Category taken' }), 'fallback')).toBe('Category taken');
        expect(apiErrorMessage(withStatus(403, 'HTTP 403: Forbidden', null), 'fallback')).toMatch(/knk\.admin\.lootbox\.manage/);
        expect(apiErrorMessage(withStatus(500, 'boom'), 'fallback')).toBe('fallback');
        expect(apiErrorMessage(new Error('promise timeout'), 'fallback')).toBe('fallback');
    });
});
