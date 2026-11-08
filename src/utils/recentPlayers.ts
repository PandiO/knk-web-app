/**
 * PandiO/knk-workspace#119 (MOD-5 "recent players"): the player profiles this staff member opened last, newest
 * first, shown on the moderation page. A per-viewer convenience in this browser only (localStorage, one list
 * per logged-in account), so it never reaches other staff or devices; it reads as empty when storage is
 * unavailable (a private window, blocked site data).
 */

export interface RecentPlayer {
    id: number;
    username: string;
    /** When the profile was opened (ISO). */
    openedAt: string;
}

export const RECENT_PLAYERS_LIMIT = 8;

const keyFor = (viewerId: number | string) => `knk.recentPlayers.${viewerId}`;

const isRecentPlayer = (value: unknown): value is RecentPlayer => {
    const v = value as RecentPlayer;
    return !!v && typeof v.id === 'number' && Number.isFinite(v.id) && typeof v.username === 'string' && typeof v.openedAt === 'string';
};

export function readRecentPlayers(viewerId: number | string | null | undefined): RecentPlayer[] {
    if (viewerId == null) return [];
    try {
        const raw = window.localStorage.getItem(keyFor(viewerId));
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isRecentPlayer).slice(0, RECENT_PLAYERS_LIMIT) : [];
    } catch {
        return [];
    }
}

/** Puts the player first (once), keeps at most RECENT_PLAYERS_LIMIT; returns the new list. */
export function rememberRecentPlayer(
    viewerId: number | string | null | undefined,
    player: { id: number; username: string },
    now: Date = new Date(),
): RecentPlayer[] {
    if (viewerId == null || !Number.isFinite(player.id) || !player.username) return readRecentPlayers(viewerId);
    const next = [
        { id: player.id, username: player.username, openedAt: now.toISOString() },
        ...readRecentPlayers(viewerId).filter(p => p.id !== player.id),
    ].slice(0, RECENT_PLAYERS_LIMIT);
    try {
        window.localStorage.setItem(keyFor(viewerId), JSON.stringify(next));
    } catch {
        // Storage full or blocked: the list just isn't kept.
    }
    return next;
}

export function clearRecentPlayers(viewerId: number | string | null | undefined): void {
    if (viewerId == null) return;
    try {
        window.localStorage.removeItem(keyFor(viewerId));
    } catch {
        // Nothing to clear.
    }
}
