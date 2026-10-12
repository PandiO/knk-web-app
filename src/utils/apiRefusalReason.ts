/**
 * The API's own explanation of a refused request (a 4xx), e.g. the 409 "This street can't be
 * deleted: it is still used by 1 structure." Undefined for a 5xx, a network error or a bare
 * "HTTP 409: Conflict", so the caller shows its own text instead. serviceCall puts the body's
 * `message` (or a short plain-text body) into Error.message and the status into `status`.
 */
export function apiRefusalReason(error: unknown): string | undefined {
    const e = error as { status?: number; message?: string } | null;
    const status = e?.status;
    if (status === undefined || status < 400 || status >= 500) return undefined;
    const message = e?.message?.trim();
    if (message && !message.startsWith('HTTP ')) return message;
    if (status === 403) return "You don't have permission to do this.";
    return undefined;
}
