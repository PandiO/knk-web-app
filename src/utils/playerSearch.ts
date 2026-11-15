/**
 * PandiO/knk-workspace#119 (MOD-5): the moderation page's player search. `POST api/Users/search` matches the
 * term as a case-insensitive substring of the username, the email and the UUID (UserRepository.SearchAsync), and
 * sorts by `username`, `email`, `uuid`, `coins`, `createdat`, `id`, and since #565 `lastseenat` and
 * `experiencepoints` (anything else: username). Since #565 it also takes the state filters `online`, `frozen` and
 * `paymentsLocked` ("true" / "false").
 *
 * UUIDs are stored with dashes (what the game server sends). Since #565 the API matches a UUID with or without them,
 * so a dashless fragment finds the player too; a whole dashless UUID is still given its dashes here, so an older API
 * finds it as before.
 */

const DASHLESS_UUID = /^[0-9a-f]{32}$/i;

/** The term as the API should get it: trimmed, a whole dashless UUID with its dashes, '' for nothing. */
export function normalizePlayerSearchTerm(raw: string | null | undefined): string {
    const term = (raw ?? '').trim();
    if (DASHLESS_UUID.test(term)) {
        const t = term.toLowerCase();
        return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
    }
    return term;
}

/** What a search term looks like, to say so under the box ("Looks like a UUID"). */
export function describePlayerSearchTerm(raw: string | null | undefined): 'uuid' | 'email' | 'name' | 'empty' {
    const term = normalizePlayerSearchTerm(raw);
    if (!term) return 'empty';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) return 'uuid';
    if (term.includes('@')) return 'email';
    return 'name';
}

/** The table's sortable columns and the server's sort key for each (UserRepository.ApplySorting). */
export const PLAYER_SORT_KEYS: Readonly<Record<string, string>> = {
    username: 'username',
    email: 'email',
    lastSeenAt: 'lastseenat',
    coins: 'coins',
    experiencePoints: 'experiencepoints',
};

/** #565: the moderation search's state filters (the API's filter keys); each is "any", yes or no. */
export type PlayerStateFilterKey = 'online' | 'frozen' | 'paymentsLocked';
export type PlayerStateFilters = Partial<Record<PlayerStateFilterKey, boolean>>;

export const PLAYER_STATE_FILTERS: ReadonlyArray<{ key: PlayerStateFilterKey; label: string; yes: string; no: string }> = [
    { key: 'online', label: 'Online', yes: 'Online', no: 'Offline' },
    { key: 'frozen', label: 'Frozen', yes: 'Frozen', no: 'Not frozen' },
    { key: 'paymentsLocked', label: 'Payments', yes: 'Locked', no: 'Not locked' },
];

/** The state filters in the URL (`?online=true&frozen=false`); anything but "true" / "false" is "any". */
export function parsePlayerStateFilters(params: URLSearchParams): PlayerStateFilters {
    const filters: PlayerStateFilters = {};
    for (const { key } of PLAYER_STATE_FILTERS) {
        const value = params.get(key);
        if (value === 'true' || value === 'false') filters[key] = value === 'true';
    }
    return filters;
}

/** The filters as `POST api/Users/search` takes them; undefined when none is set. */
export function playerStateFiltersToApi(filters: PlayerStateFilters): Record<string, string> | undefined {
    const entries = PLAYER_STATE_FILTERS.filter(f => filters[f.key] !== undefined).map(f => [f.key, String(filters[f.key])]);
    return entries.length ? Object.fromEntries(entries) : undefined;
}

/** A sort read from the URL, or null when it isn't one the server knows (the server's default: username). */
export function parsePlayerSort(key: string | null, dir: string | null): { key: string; descending: boolean } | null {
    if (!key || !(key in PLAYER_SORT_KEYS)) return null;
    return { key, descending: dir === 'desc' };
}
