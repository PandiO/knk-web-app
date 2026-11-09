import {
    describeBasisPoints, describeHours, describePerMille, describeSeconds, describeTicks, describeWorldTime,
    formatDuration, formatOneIn, joinHint, readNumber,
} from '../settingsUnits';

// PandiO/knk-workspace#26 (SET-5): what a settings value means, next to its unit. setupTests pins numbers to en-US.

describe('settingsUnits', () => {
    it('reads typed numbers and ignores the rest', () => {
        expect(readNumber(' 20 ')).toBe(20);
        expect(readNumber('1.5')).toBe(1.5);
        expect(readNumber('')).toBeNull();
        expect(readNumber('abc')).toBeNull();
        expect(readNumber(null)).toBeNull();
    });

    it('formats durations with their two largest parts', () => {
        expect(formatDuration(45)).toBe('45 s');
        expect(formatDuration(90)).toBe('1 min 30 s');
        expect(formatDuration(3600)).toBe('1 h');
        expect(formatDuration(5400)).toBe('1 h 30 min');
        expect(formatDuration(86400 * 2 + 3600 * 4 + 60)).toBe('2 days 4 h');
        expect(formatDuration(86400)).toBe('1 day');
        expect(formatDuration(0)).toBe('0 s');
    });

    it('turns ticks into time (20 per second)', () => {
        expect(describeTicks(20)).toBe('= 1 s');
        expect(describeTicks('10')).toBe('= 0.5 s');
        expect(describeTicks(1200)).toBe('= 1 min');
        expect(describeTicks(0)).toBe('= no delay');
        expect(describeTicks('')).toBeNull();
        expect(describeTicks(-1)).toBeNull();
    });

    it('spells out seconds and hours only where the unit alone is hard to read', () => {
        expect(describeSeconds(59)).toBeNull();
        expect(describeSeconds(600)).toBe('= 10 min');
        expect(describeHours(12)).toBeNull();
        expect(describeHours(48)).toBe('= 2 days');
    });

    it('turns per mille and basis points into percentages', () => {
        expect(describePerMille(30)).toBe('= 3%');
        expect(describePerMille(5)).toBe('= 0.5%');
        expect(describeBasisPoints(250)).toBe('= 2.5%');
        expect(describeBasisPoints(0, 'no fee')).toBe('= no fee');
        expect(describeBasisPoints(0)).toBe('= 0%');
        expect(describeBasisPoints('x')).toBeNull();
    });

    it('reads world time like /time set', () => {
        expect(describeWorldTime(0)).toBe('= 06:00 (sunrise)');
        expect(describeWorldTime(6000)).toBe('= 12:00 (noon)');
        expect(describeWorldTime(18000)).toBe('= 00:00 (midnight)');
        expect(describeWorldTime(1500)).toBe('= 07:30');
        expect(describeWorldTime(30000)).toBe('= 12:00 (noon)');
    });

    it('shows small chances as 1 in N', () => {
        expect(formatOneIn(0.05)).toBe('1 in 2,000');
        expect(formatOneIn(12.5)).toBe('1 in 8');
        expect(formatOneIn(30)).toBe('1 in 3.3');
        expect(formatOneIn(50)).toBeNull();
        expect(formatOneIn(0)).toBeNull();
        expect(formatOneIn(NaN)).toBeNull();
    });

    it('joins help and meaning, skipping empty parts', () => {
        expect(joinHint('Help.', '= 1 s')).toBe('Help. = 1 s');
        expect(joinHint('Help.', null, false)).toBe('Help.');
        expect(joinHint(null, undefined)).toBeUndefined();
    });
});
