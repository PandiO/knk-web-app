/**
 * The API's own explanation of a refused request (a 4xx), e.g. the 409 "This street can't be
 * deleted: it is still used by 1 structure." Undefined for a 5xx, a network error or a bare
 * "HTTP 409: Conflict", so the caller shows its own text instead. serviceCall puts the body's
 * `message` (or a short plain-text body) into Error.message, the body into `response` and the
 * status into `status`. Show it as `apiRefusalReason(error) ?? '<what failed>'` (KNG-169).
 *
 * A 5xx counts only when the API answered it deliberately with an `{ error, message }` body, e.g.
 * the 503 "Statistics are disabled (...)" or the 502 "The confirmation email could not be sent."
 */
export function apiRefusalReason(error: unknown): string | undefined {
    const e = error as { status?: number; message?: string; response?: unknown } | null;
    const status = e?.status;
    if (status === undefined || status < 400) return undefined;
    if (status >= 500) return deliberateServerReason(e?.response);
    const body = responseBodyReason(e?.response);
    if (body) return body;
    const message = e?.message?.trim();
    if (message && !message.startsWith('HTTP ')) return message;
    if (status === 403) return "You don't have permission to do this.";
    return undefined;
}

/** A plain-text body or a `{ message }` body of a failed response; undefined for anything else (HTML, empty). */
export function responseBodyReason(response: unknown): string | undefined {
    if (typeof response === 'string') {
        const text = response.trim();
        return text && !text.startsWith('<') ? text : undefined;
    }
    if (response && typeof response === 'object') {
        const message = (response as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message.trim();
    }
    return undefined;
}

/**
 * For a catch that also sees errors the app throws itself (e.g. a form that can't be normalized):
 * the API's refusal reason for a response, the app error's own message otherwise. Undefined for a
 * server error, a timeout ("promise timeout") or a network failure / code bug (a TypeError).
 */
export function failureReason(error: unknown): string | undefined {
    if (typeof (error as { status?: unknown } | null)?.status === 'number') return apiRefusalReason(error);
    if (!(error instanceof Error) || error instanceof TypeError) return undefined;
    const message = error.message?.trim();
    return message && message !== 'promise timeout' && !message.startsWith('HTTP ') ? message : undefined;
}

/** The message of a deliberate `{ error: "Code", message }` answer, the only 5xx body worth showing. */
function deliberateServerReason(response: unknown): string | undefined {
    const body = response as { error?: unknown; message?: unknown } | null | undefined;
    if (!body || typeof body !== 'object' || typeof body.error !== 'string' || !body.error) return undefined;
    return typeof body.message === 'string' && body.message.trim() ? body.message.trim() : undefined;
}
