import { LootboxOddsDto, LootboxTypeDto, MAX_BOX_STARS } from '../types/dtos/lootbox/LootboxDtos';

// Pure helpers for the lootbox admin page (docs/specs/lootboxes/DESIGN.md §3.6).

/** "★5" for a grade's stars; "-" when unknown. */
export const starLabel = (stars?: number | null): string => (stars ? `★${stars}` : '-');

/**
 * A 0-100 percentage for the odds tables: whole-ish numbers keep two decimals, small ones keep three
 * significant digits so a 0.05% jackpot doesn't read as 0.00%.
 */
export function formatPercent(percent: number): string {
    if (!Number.isFinite(percent)) return '-';
    if (percent === 0) return '0%';
    const abs = Math.abs(percent);
    const text = abs >= 1
        ? percent.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : percent.toLocaleString('en-US', { maximumSignificantDigits: 3 });
    return `${text}%`;
}

/** A special entry's per-million chance as a percentage (500 per million = 0.05%). */
export const perMillionToPercent = (chancePerMillion: number): number => chancePerMillion / 10_000;

/** The item-grade window of one box grade: [max(1, B - spread), B] (DESIGN.md §3.1 step 2). */
export function gradeWindow(boxStars: number, spread: number): number[] {
    const low = Math.max(1, boxStars - Math.max(0, spread));
    const stars: number[] = [];
    for (let s = low; s <= boxStars; s++) stars.push(s);
    return stars;
}

const typeStarRange = (type: Pick<LootboxTypeDto, 'minBoxStars' | 'maxBoxStars'>): [number, number] => {
    const max = Math.min(MAX_BOX_STARS, Math.max(1, type.maxBoxStars));
    const min = Math.min(max, Math.max(1, type.minBoxStars));
    return [min, max];
};

/** Every item grade any box of this type can roll from, low to high. */
export function reachableItemStars(type: Pick<LootboxTypeDto, 'minBoxStars' | 'maxBoxStars' | 'itemStarSpread'>): number[] {
    const [min, max] = typeStarRange(type);
    return gradeWindow(max, max - min + type.itemStarSpread);
}

/**
 * The box grades whose odds, fetched together, cover every item grade of the type's windows - one
 * request per (spread + 1) stars instead of one per box grade: max, max - spread - 1, ..., and the
 * minimum itself when the steps skip past its low end.
 */
export function coveringBoxStars(type: Pick<LootboxTypeDto, 'minBoxStars' | 'maxBoxStars' | 'itemStarSpread'>): number[] {
    const [min, max] = typeStarRange(type);
    const spread = Math.max(0, type.itemStarSpread);
    const result: number[] = [];
    for (let b = max; b >= min; b -= spread + 1) result.push(b);
    const lowestCovered = Math.max(1, result[result.length - 1] - spread);
    if (lowestCovered > Math.max(1, min - spread)) result.push(min);
    return result;
}

/** The box grades to ask the batch odds for: every type's covering grades together, high to low, without repeats. */
export function coveringBoxStarsOf(types: Pick<LootboxTypeDto, 'minBoxStars' | 'maxBoxStars' | 'itemStarSpread'>[]): number[] {
    return Array.from(new Set(types.flatMap(coveringBoxStars))).sort((a, b) => b - a);
}

/** Pool size per item-grade stars, merged from odds responses (a grade with no items never appears in them). */
export function poolCountsByStars(odds: Pick<LootboxOddsDto, 'itemGrades'>[]): Record<number, number> {
    const counts: Record<number, number> = {};
    odds.forEach(o => o.itemGrades.forEach(g => {
        counts[g.stars] = Math.max(counts[g.stars] ?? 0, g.itemCount ?? 0);
    }));
    return counts;
}

/** The item grades inside the type's windows that have no pool item: those boxes fall back to a nearer grade. */
export function emptyWindowStars(
    type: Pick<LootboxTypeDto, 'minBoxStars' | 'maxBoxStars' | 'itemStarSpread'>,
    counts: Record<number, number>
): number[] {
    return reachableItemStars(type).filter(s => !counts[s]);
}

/**
 * The API's own explanation of a refused request (400/403/404/409), else `fallback`. serviceCall puts
 * `{message}` bodies into Error.message and keeps a plain-text body in `response`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
    const e = err as { status?: number; message?: string; response?: unknown } | null;
    const status = e?.status;
    if (status === undefined || status < 400 || status >= 500) return fallback;
    if (typeof e?.response === 'string' && e.response.trim()) return e.response.trim();
    if (e?.response && typeof e.response === 'object') {
        const body = e.response as { message?: unknown; title?: unknown };
        if (typeof body.message === 'string' && body.message) return body.message;
    }
    if (status === 403) return 'You need the knk.admin.lootbox.manage permission for this.';
    return e?.message && !e.message.startsWith('HTTP ') ? e.message : fallback;
}

/** "2026-09-26T18:05:00Z" → the viewer's local date/time; "-" when missing. */
export function formatDateTime(iso?: string | null): string {
    if (!iso) return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}
