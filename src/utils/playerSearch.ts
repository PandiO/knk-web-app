/**
 * PandiO/knk-workspace#119 (MOD-5): the moderation page's player search. `POST api/Users/search` matches the
 * term as a case-insensitive substring of the username, the email and the UUID (UserRepository.SearchAsync), and
 * sorts by `username`, `email`, `uuid`, `coins`, `createdat` or `id` (anything else: username).
 *
 * UUIDs are stored with dashes (what the game server sends), so a UUID pasted without them (from a log or
 * another tool) found nothing before. A whole dashless UUID is given its dashes here; a part of one is sent as
 * typed (substring match, so only a dashed fragment finds anything).
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
    coins: 'coins',
};

/** A sort read from the URL, or null when it isn't one the server knows (the server's default: username). */
export function parsePlayerSort(key: string | null, dir: string | null): { key: string; descending: boolean } | null {
    if (!key || !(key in PLAYER_SORT_KEYS)) return null;
    return { key, descending: dir === 'desc' };
}
