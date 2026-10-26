/**
 * Where to go back to: after logging in, and (#177 link 1, #58) after a form opened from another
 * page is submitted or cancelled. Only same-origin paths are accepted, so a crafted link
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

/** The `returnTo` query parameter of a page, if it's safe. */
export function readReturnTo(searchParams: URLSearchParams): string | null {
  return sanitizeReturnTo(searchParams.get('returnTo'));
}

/** The `returnTo` for the page at `location` (path and query), if it's safe. */
export function buildReturnTo(location: { pathname: string; search?: string }): string | null {
  return sanitizeReturnTo(`${location.pathname}${location.search ?? ''}`);
}

/** `path` with `returnTo` added to its query when `returnTo` is safe. */
export function withReturnTo(path: string, returnTo: string | null | undefined): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return path;
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('returnTo', safe);
  return `${base}?${params.toString()}`;
}

/** The dashboard on one entity type (`/dashboard/:entityName`), or the bare dashboard. */
export function dashboardPath(entityTypeName?: string | null): string {
  return entityTypeName ? `/dashboard/${encodeURIComponent(entityTypeName)}` : '/dashboard';
}

/** The edit form of one entity, coming back to `returnTo`. */
export function editFormPath(entityTypeName: string, entityId: string | number, returnTo?: string | null): string {
  return withReturnTo(
    `/forms/${encodeURIComponent(entityTypeName)}/edit/${encodeURIComponent(String(entityId))}`,
    returnTo
  );
}

/** The default form for a new entity (`autoOpen`), coming back to `returnTo`. */
export function newFormPath(entityTypeName: string, returnTo?: string | null): string {
  return withReturnTo(`/forms/${encodeURIComponent(entityTypeName)}?autoOpen=true`, returnTo);
}
