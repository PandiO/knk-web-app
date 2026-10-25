import { describeCheckedAgo } from '../validationResultAge';

describe('describeCheckedAgo (KNG-269)', () => {
    const now = new Date('2026-10-23T12:00:00Z');

    it.each([
        ['2026-10-23T11:59:40Z', 'just now'],
        ['2026-10-23T11:55:00Z', '5 min ago'],
        ['2026-10-23T10:00:00Z', '2 h ago'],
        ['2026-10-22T11:00:00Z', '25 h ago'],
        ['2026-10-20T12:00:00Z', '3 days ago']
    ])('%s → %s', (iso, expected) => {
        expect(describeCheckedAgo(iso, now)).toBe(expected);
    });

    it('is empty for a missing or unreadable time', () => {
        expect(describeCheckedAgo(undefined, now)).toBe('');
        expect(describeCheckedAgo('not a date', now)).toBe('');
    });

    it('never says negative for a clock slightly ahead', () => {
        expect(describeCheckedAgo('2026-10-23T12:00:30Z', now)).toBe('just now');
    });
});
