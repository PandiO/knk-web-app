/**
 * The API's reason for a refused Game Settings request (a 400 names the field, e.g. a hub spawn in another world),
 * else {@code fallback}. A server error or a network failure gets the fallback: it has nothing the admin can act on.
 */
export function gameSettingsErrorMessage(err: unknown, fallback: string): string {
    const e = err as { status?: number; message?: string; response?: unknown } | null;
    const status = e?.status;
    if (status === undefined || status < 400 || status >= 500) return fallback;
    if (status === 401) return 'Your session has ended. Log in again and retry.';
    if (status === 403) return 'You need the knk.admin.config permission to change the Game Settings.';
    if (typeof e?.response === 'string' && e.response.trim()) return e.response.trim();
    if (e?.response && typeof e.response === 'object') {
        const body = e.response as { message?: unknown; title?: unknown; errors?: unknown };
        if (typeof body.message === 'string' && body.message) return body.message;
        if (body.errors && typeof body.errors === 'object') {
            const first = Object.values(body.errors as Record<string, unknown>).flat().find(v => typeof v === 'string');
            if (typeof first === 'string') return first;
        }
        if (typeof body.title === 'string' && body.title) return body.title;
    }
    return e?.message && !e.message.startsWith('HTTP ') ? e.message : fallback;
}
