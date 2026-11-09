import { describePlayerSearchTerm, normalizePlayerSearchTerm, parsePlayerSort, PLAYER_SORT_KEYS } from '../playerSearch';
import { clearRecentPlayers, readRecentPlayers, rememberRecentPlayer, RECENT_PLAYERS_LIMIT } from '../recentPlayers';

// PandiO/knk-workspace#119 (MOD-5): player search and recent players on the moderation page.

describe('normalizePlayerSearchTerm', () => {
    it('trims, and gives a whole dashless UUID its dashes (the API stores them dashed)', () => {
        expect(normalizePlayerSearchTerm('  Steve ')).toBe('Steve');
        expect(normalizePlayerSearchTerm('069A79F444E94726A5BEFCA90E38AAF5')).toBe('069a79f4-44e9-4726-a5be-fca90e38aaf5');
        expect(normalizePlayerSearchTerm('069a79f4-44e9-4726-a5be-fca90e38aaf5')).toBe('069a79f4-44e9-4726-a5be-fca90e38aaf5');
        // A part of one, or 32 characters that aren't hex, is left as typed.
        expect(normalizePlayerSearchTerm('069a79f444e9')).toBe('069a79f444e9');
        expect(normalizePlayerSearchTerm('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
        expect(normalizePlayerSearchTerm(undefined)).toBe('');
    });

    it('tells what a term looks like', () => {
        expect(describePlayerSearchTerm('')).toBe('empty');
        expect(describePlayerSearchTerm('069a79f444e94726a5befca90e38aaf5')).toBe('uuid');
        expect(describePlayerSearchTerm('p@example.org')).toBe('email');
        expect(describePlayerSearchTerm('Steve')).toBe('name');
    });

    it('reads only sorts the server knows from the URL', () => {
        expect(parsePlayerSort('coins', 'desc')).toEqual({ key: 'coins', descending: true });
        expect(parsePlayerSort('username', 'asc')).toEqual({ key: 'username', descending: false });
        expect(parsePlayerSort('experiencePoints', 'desc')).toBeNull();
        expect(parsePlayerSort(null, null)).toBeNull();
        expect(Object.values(PLAYER_SORT_KEYS)).toEqual(['username', 'email', 'coins']);
    });
});

describe('recent players', () => {
    beforeEach(() => window.localStorage.clear());

    it('keeps the last opened profiles per viewer, newest first, once each, at most the limit', () => {
        rememberRecentPlayer(1, { id: 10, username: 'Steve' }, new Date('2026-11-08T10:00:00Z'));
        rememberRecentPlayer(1, { id: 11, username: 'Alex' });
        rememberRecentPlayer(1, { id: 10, username: 'Steve' });
        expect(readRecentPlayers(1).map(p => p.username)).toEqual(['Steve', 'Alex']);
        expect(readRecentPlayers(2)).toEqual([]);

        for (let i = 0; i < RECENT_PLAYERS_LIMIT + 3; i++) rememberRecentPlayer(1, { id: 100 + i, username: `P${i}` });
        expect(readRecentPlayers(1)).toHaveLength(RECENT_PLAYERS_LIMIT);
        expect(readRecentPlayers(1)[0].username).toBe(`P${RECENT_PLAYERS_LIMIT + 2}`);

        clearRecentPlayers(1);
        expect(readRecentPlayers(1)).toEqual([]);
    });

    it('reads as empty without a viewer, with broken data, or when storage throws', () => {
        expect(readRecentPlayers(undefined)).toEqual([]);
        expect(rememberRecentPlayer(null, { id: 1, username: 'A' })).toEqual([]);
        window.localStorage.setItem('knk.recentPlayers.1', '{not json');
        expect(readRecentPlayers(1)).toEqual([]);
        window.localStorage.setItem('knk.recentPlayers.1', JSON.stringify([{ id: 'x' }, { id: 2, username: 'B', openedAt: 'now' }]));
        expect(readRecentPlayers(1).map(p => p.id)).toEqual([2]);

        const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        try {
            expect(readRecentPlayers(1)).toEqual([]);
            expect(rememberRecentPlayer(1, { id: 3, username: 'C' }).map(p => p.id)).toEqual([3]);
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
        }
    });
});
