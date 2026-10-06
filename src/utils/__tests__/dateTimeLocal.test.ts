import { dateTimeLocalDaysFromNow, toDateTimeLocalValue } from '../dateTimeLocal';

describe('dateTimeLocal', () => {
    it('formats local wall-clock time with zero padding', () => {
        expect(toDateTimeLocalValue(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03');
    });

    it('adds whole days in local time, across a month boundary', () => {
        expect(dateTimeLocalDaysFromNow(1, new Date(2026, 9, 31, 23, 45))).toBe('2026-11-01T23:45');
    });

    it('round-trips through new Date() as local time', () => {
        const from = new Date(2026, 9, 6, 18, 30);
        expect(new Date(dateTimeLocalDaysFromNow(1, from)).getTime()).toBe(new Date(2026, 9, 7, 18, 30).getTime());
    });
});
