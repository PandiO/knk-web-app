/**
 * Where to go after logging in. Only same-origin paths are accepted, so a crafted link
 * (`/auth/login?returnTo=https://evil.example`) can't send a player to another site.
 */
const BASE = 'http://knk.invalid';

/** The path when `value` is a safe same-origin path (`/...`, not `//...`), otherwise null. */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  // Browsers read `\` as `/` (`/\evil.example`) and drop tabs and newlines (`/\t/evil.example`).
  // eslint-disable-next-line no-control-regex
  if (path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return null;
  let url: URL;
  try {
    url = new URL(path, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  // Coming back to a login or register page would be a loop.
  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The path of react-router's `location.state.from` (set by ProtectedRoute), if it's safe. */
export function returnToFromState(state: unknown): string | null {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)?.from;
  if (!from || typeof from.pathname !== 'string') return null;
  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';
  return sanitizeReturnTo(`${from.pathname}${search}${hash}`);
}

/** `/auth/login`, with `returnTo` when the path is safe and `reason` (e.g. `expired`) when given. */
export function buildLoginRedirect(path: string | null | undefined, reason?: string): string {
  const params = new URLSearchParams();
  const safe = sanitizeReturnTo(path);
  if (safe && safe !== '/') params.set('returnTo', safe);
  if (reason) params.set('reason', reason);
  const query = params.toString();
  return query ? `/auth/login?${query}` : '/auth/login';
}
