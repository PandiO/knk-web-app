/**
 * Entity types starred in the dashboard's explorer (PandiO/knk-workspace#194): listed at the top.
 * Per browser (localStorage), like the last viewed type (`knk.dashboard.lastEntityType`); per account
 * on the API can come later. Storage that is blocked, full or corrupt just means no favourites.
 */
const KEY = 'knk.dashboard.favouriteEntityTypes';

/** The starred entity names as stored (original casing), without duplicates. */
export function readDashboardFavourites(): string[] {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        return parsed.filter((name): name is string => {
            if (typeof name !== 'string' || !name) return false;
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch {
        return [];
    }
}

export function writeDashboardFavourites(entityNames: string[]): void {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(entityNames));
    } catch {
        // Not remembered; the stars last until the page is left.
    }
}

/** `entityNames` with `entityName` added, or removed when it was there (case-insensitive). */
export function toggleFavourite(entityNames: string[], entityName: string): string[] {
    const key = entityName.toLowerCase();
    return entityNames.some(name => name.toLowerCase() === key)
        ? entityNames.filter(name => name.toLowerCase() !== key)
        : [...entityNames, entityName];
}
