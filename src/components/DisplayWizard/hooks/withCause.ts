/** Copies a failed request's `status` and `response` onto the error a hook shows (#189), so the page can explain it. */
export function withCause(error: Error, cause: unknown): Error & { status?: number; response?: unknown } {
  const source = cause as { status?: unknown; response?: unknown } | null;
  return Object.assign(error, {
    status: typeof source?.status === 'number' ? source.status : undefined,
    response: source?.response,
  });
}
