import { formatNumber } from './format';

/**
 * PandiO/knk-workspace#26 (SET-5): units on settings fields. A field shows its unit next to the input
 * (`Field`'s `unit`) and, where the raw number is hard to read, what the value means right now: `20` ticks
 * "= 1 s", `250` basis points "= 2.5%", `30`‰ "= 3%", `6000` world-time ticks "= 12:00". Numbers use
 * format.ts (the viewer's locale). Each helper answers null when there is nothing to add (an empty or invalid
 * value, or a value the unit already says plainly), so a page can write `hint={join(help, describe(value))}`.
 */

/** The unit labels shown next to settings inputs, one spelling for every page. */
export const UNIT = {
    ticks: 'ticks',
    seconds: 's',
    minutes: 'min',
    hours: 'h',
    perMille: '‰',
    basisPoints: 'bp',
    percent: '%',
    multiplier: '×',
    stars: '★',
    coins: 'coins',
    gems: 'gems',
    boxes: 'boxes',
    blocks: 'blocks',
} as const;

/** Minecraft runs 20 ticks per second. */
export const TICKS_PER_SECOND = 20;

/** A whole or decimal number typed by staff, or null when the text is empty or not a number. */
export const readNumber = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (text === '') return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
};

const fmt = (n: number, digits = 1) => formatNumber(n, { maximumFractionDigits: digits });

/** "1 h 30 min", "2 days 4 h", "45 s": the two largest parts of a duration, for seconds ≥ 1. */
export const formatDuration = (totalSeconds: number): string => {
    const seconds = Math.round(totalSeconds);
    const parts: Array<[number, string]> = [
        [Math.floor(seconds / 86400), 'day'],
        [Math.floor((seconds % 86400) / 3600), 'h'],
        [Math.floor((seconds % 3600) / 60), 'min'],
        [seconds % 60, 's'],
    ];
    const first = parts.findIndex(([n]) => n > 0);
    if (first < 0) return '0 s';
    return parts.slice(first, first + 2)
        .filter(([n]) => n > 0)
        .map(([n, unit]) => (unit === 'day' ? `${fmt(n, 0)} day${n === 1 ? '' : 's'}` : `${fmt(n, 0)} ${unit}`))
        .join(' ');
};

/** Ticks as time: 20 → "= 1 s", 10 → "= 0.5 s", 1200 → "= 1 min". */
export const describeTicks = (value: string | number | null | undefined): string | null => {
    const n = readNumber(value);
    if (n === null || n < 0) return null;
    if (n === 0) return '= no delay';
    const seconds = n / TICKS_PER_SECOND;
    return seconds < 60 ? `= ${fmt(seconds, 2)} s` : `= ${formatDuration(seconds)}`;
};

/** Seconds from a minute up: 600 → "= 10 min"; under a minute the unit says it already (null). */
export const describeSeconds = (value: string | number | null | undefined): string | null => {
    const n = readNumber(value);
    if (n === null || n < 60) return null;
    return `= ${formatDuration(n)}`;
};

/** Hours from a day up: 48 → "= 2 days". */
export const describeHours = (value: string | number | null | undefined): string | null => {
    const n = readNumber(value);
    if (n === null || n < 24) return null;
    return `= ${formatDuration(n * 3600)}`;
};

/** Per mille as a percentage: 30 → "= 3%". */
export const describePerMille = (value: string | number | null | undefined): string | null => {
    const n = readNumber(value);
    if (n === null || n < 0) return null;
    return `= ${fmt(n / 10, 2)}%`;
};

/** Basis points as a percentage: 250 → "= 2.5%", 0 → "= no fee" when `zero` says so. */
export const describeBasisPoints = (value: string | number | null | undefined, zero?: string): string | null => {
    const n = readNumber(value);
    if (n === null || n < 0) return null;
    if (n === 0 && zero) return `= ${zero}`;
    return `= ${fmt(n / 100, 2)}%`;
};

/**
 * World time in ticks as a clock time, as /time set does it: 0 is 06:00 (sunrise), 6000 noon, 18000 midnight;
 * one day is 24000 ticks.
 */
export const describeWorldTime = (value: string | number | null | undefined): string | null => {
    const n = readNumber(value);
    if (n === null || n < 0) return null;
    const dayTicks = ((Math.round(n) % 24000) + 24000) % 24000;
    const hoursFloat = (dayTicks / 1000 + 6) % 24;
    const hours = Math.floor(hoursFloat);
    const minutes = Math.floor((hoursFloat - hours) * 60);
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const named: Record<number, string> = { 0: 'sunrise', 6000: 'noon', 12000: 'sunset', 18000: 'midnight' };
    return `= ${clock}${named[dayTicks] ? ` (${named[dayTicks]})` : ''}`;
};

/**
 * A chance as "1 in N" (#38): 0.05% → "1 in 2,000", 12.5% → "1 in 8". Null for 0 and for chances of 50% and
 * more, where "1 in 1.5" reads worse than the percentage. N is rounded to a whole number from 10 up.
 */
export const formatOneIn = (percent: number | null | undefined): string | null => {
    if (percent === null || percent === undefined || !Number.isFinite(percent) || percent <= 0 || percent >= 50) return null;
    const n = 100 / percent;
    return `1 in ${formatNumber(n, { maximumFractionDigits: n >= 10 ? 0 : 1 })}`;
};

/** Joins a field's help text and what its value means, skipping the empty parts: "Rolling 24 h. = 2.5%". */
export const joinHint = (...parts: Array<string | null | undefined | false>): string | undefined => {
    const text = parts.filter(Boolean).join(' ');
    return text === '' ? undefined : text;
};
