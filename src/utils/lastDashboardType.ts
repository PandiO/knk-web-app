/**
 * The entity type the dashboard showed last (#177 decision 1): bare `/dashboard` reopens it.
 * Per browser (localStorage); storage that is blocked or full just means no memory.
 */
const KEY = 'knk.dashboard.lastEntityType';

export function readLastDashboardType(): string | null {
    try {
        return window.localStorage.getItem(KEY) || null;
    } catch {
        return null;
    }
}

export function writeLastDashboardType(entityTypeName: string): void {
    try {
        window.localStorage.setItem(KEY, entityTypeName);
    } catch {
        // Not remembered; the dashboard falls back to its default type.
    }
}
