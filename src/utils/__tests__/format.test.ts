import {
    EMPTY_VALUE,
    formatDate,
    formatDateTime,
    formatNumber,
    formatPercent,
    formatTime,
    isIsoDateTimeString,
    numberFormat,
    parseApiDate,
    parseUtc,
    setNumberLocale,
} from '../format';

// PandiO/knk-workspace#187 (X-10). Jest runs in UTC; the expected strings are built with the same
// Intl options, so the tests hold in any locale the machine has.

describe('format.ts: reading API dates', () => {
    it('reads a zone-less API date as UTC, not local time', () => {
        expect(parseUtc('2026-11-05T20:52:02').toISOString()).toBe('2026-11-05T20:52:02.000Z');
        expect(parseUtc('2026-11-05 20:52:02').toISOString()).toBe('2026-11-05T20:52:02.000Z');
        expect(parseUtc('2026-11-05T20:52:02.1234567').toISOString()).toBe('2026-11-05T20:52:02.123Z');
    });

    it('keeps an explicit zone', () => {
        expect(parseUtc('2026-11-05T20:52:02Z').toISOString()).toBe('2026-11-05T20:52:02.000Z');
        expect(parseUtc('2026-11-05T21:52:02+01:00').toISOString()).toBe('2026-11-05T20:52:02.000Z');
    });

    it('parseApiDate takes dates, numbers and strings, and gives null for nothing or nonsense', () => {
        const date = new Date('2026-11-05T20:52:02Z');
        expect(parseApiDate(date)).toBe(date);
        expect(parseApiDate(date.getTime())?.toISOString()).toBe(date.toISOString());
        expect(parseApiDate('2026-11-05T20:52:02')?.toISOString()).toBe(date.toISOString());
        expect(parseApiDate(null)).toBeNull();
        expect(parseApiDate(undefined)).toBeNull();
        expect(parseApiDate('')).toBeNull();
        expect(parseApiDate('not a date')).toBeNull();
    });

    it('recognises ISO date-times only', () => {
        expect(isIsoDateTimeString('2026-11-05T20:52:02')).toBe(true);
        expect(isIsoDateTimeString('2026-11-05T20:52:02.123Z')).toBe(true);
        expect(isIsoDateTimeString('2026-11-05T20:52+01:00')).toBe(true);
        expect(isIsoDateTimeString('2026-11-05')).toBe(false);
        expect(isIsoDateTimeString('Harbour 2026-11-05T20:52')).toBe(false);
        expect(isIsoDateTimeString('12')).toBe(false);
        expect(isIsoDateTimeString(12)).toBe(false);
    });
});

describe('format.ts: dates and times in the viewer\'s locale', () => {
    const at = new Date('2026-11-05T20:52:02Z');

    it('formats date and time to the minute', () => {
        expect(formatDateTime('2026-11-05T20:52:02')).toBe(
            at.toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
        expect(formatDateTime('2026-11-05T20:52:02')).not.toContain('T');
    });

    it('formats the date or the time alone', () => {
        expect(formatDate('2026-11-05T20:52:02Z')).toBe(at.toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' }));
        expect(formatTime('2026-11-05T20:52:02Z')).toBe(at.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }));
    });

    it('shows a bare calendar date as that day', () => {
        expect(formatDate('2026-11-05')).toBe(
            new Date(Date.UTC(2026, 10, 5)).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }));
    });

    it('takes other options and a fallback', () => {
        expect(formatDateTime(at, { year: 'numeric' })).toBe(at.toLocaleString(undefined, { year: 'numeric' }));
        expect(formatDateTime(null)).toBe(EMPTY_VALUE);
        expect(formatDateTime('nonsense', undefined, 'never')).toBe('never');
    });
});

describe('format.ts: numbers (pinned to en-US in setupTests)', () => {
    it('groups thousands with commas and uses a point for decimals', () => {
        expect(formatNumber(1234567)).toBe('1,234,567');
        expect(formatNumber(-1234.5)).toBe('-1,234.5');
        expect(formatNumber('42')).toBe('42');
        expect(numberFormat.format(1000)).toBe('1,000');
    });

    it('takes Intl options', () => {
        expect(formatNumber(0.4, { minimumFractionDigits: 2 })).toBe('0.40');
    });

    it('shows the fallback for nothing or nonsense', () => {
        expect(formatNumber(null)).toBe(EMPTY_VALUE);
        expect(formatNumber(undefined)).toBe(EMPTY_VALUE);
        expect(formatNumber('')).toBe(EMPTY_VALUE);
        expect(formatNumber('abc', undefined, 'n/a')).toBe('n/a');
        expect(formatNumber(Number.NaN)).toBe(EMPTY_VALUE);
    });

    it('formats fractions as percentages', () => {
        expect(formatPercent(0.125)).toBe('12.5%');
        expect(formatPercent(0.12345, 2)).toBe('12.35%');
        expect(formatPercent(null)).toBe(EMPTY_VALUE);
    });
});

describe('format.ts: numbers follow the viewer\'s language (LW3-1)', () => {
    afterEach(() => setNumberLocale('en-US'));

    it('a Dutch browser gets points for thousands and a comma for decimals', () => {
        setNumberLocale('nl-NL');
        expect(formatNumber(12345)).toBe('12.345');
        expect(formatNumber(-1234.5)).toBe('-1.234,5');
        expect(numberFormat.format(1000)).toBe('1.000');
        expect(formatNumber(0.4, { minimumFractionDigits: 2 })).toBe('0,40');
        expect(formatPercent(0.125)).toBe(`12,5${new Intl.NumberFormat('nl-NL', { style: 'percent' }).format(0).slice(1)}`);
    });

    it('an English browser gets commas for thousands', () => {
        setNumberLocale('en-GB');
        expect(formatNumber(12345)).toBe('12,345');
    });

    it('without a pin it uses the browser\'s own locale', () => {
        setNumberLocale(undefined);
        expect(formatNumber(12345)).toBe(new Intl.NumberFormat().format(12345));
        expect(numberFormat.format(12345)).toBe((12345).toLocaleString());
    });
});
