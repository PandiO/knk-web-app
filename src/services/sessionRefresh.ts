import ConfigurationHelper from "../utils/config-helper";
import { tokenService } from "../utils/tokenService";
import { buildLoginRedirect } from "../utils/returnTo";

/**
 * Wraps an async function so concurrent callers share one in-flight call. Once it settles, the
 * next caller starts a new one.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = fn().finally(() => {
        pending = null;
      });
    }
    return pending;
  };
}

/**
 * How a refresh ended: `renewed` (new access token stored), `rejected` (the API says the session
 * is gone: 401/403) or `unavailable` (network error, 5xx, rate limit, unreadable reply - the
 * session may well still be valid, so callers must not end it).
 */
export type RefreshOutcome = "renewed" | "rejected" | "unavailable";

/**
 * POST Auth/refresh with the HttpOnly refresh cookie, and store the new access token. Never throws.
 */
async function requestNewAccessToken(): Promise<RefreshOutcome> {
  try {
    const response = await fetch(`${ConfigurationHelper.gatewayApiUrl}/Auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.status === 401 || response.status === 403) {
      return "rejected";
    }
    if (!response.ok) {
      return "unavailable";
    }
    const body = await response.json().catch(() => null);
    if (!body || typeof body.accessToken !== "string" || !body.accessToken) {
      return "unavailable";
    }
    tokenService.setAccessToken(body.accessToken, tokenService.isRemembered());
    return "renewed";
  } catch {
    return "unavailable";
  }
}

/**
 * The only way the app refreshes a session. The API rotates the refresh token on every use and
 * treats a reused one as stolen (it ends the whole session), so parallel 401s must share one
 * refresh.
 */
export const refreshSession = singleFlight(requestNewAccessToken);

/** True when the refresh stored a new access token (shares the in-flight refresh). */
export const refreshAccessToken = (): Promise<boolean> => refreshSession().then(outcome => outcome === "renewed");

type SessionExpiredHandler = () => void;

let redirecting = false;

/** Default: clear the stored session and go to the login page with a "session expired" banner. */
const redirectToLogin: SessionExpiredHandler = () => {
  if (redirecting) return;
  const { pathname, search, hash } = window.location;
  // Already on a login/register page: nothing to come back to.
  if (pathname.startsWith("/auth/")) return;
  redirecting = true;
  window.location.assign(buildLoginRedirect(`${pathname}${search}${hash}`, "expired"));
};

let sessionExpiredHandler: SessionExpiredHandler = redirectToLogin;

/** Called when a logged-in request got 401 and the refresh failed too. */
export function handleSessionExpired(): void {
  tokenService.clearAll();
  sessionExpiredHandler();
}

/** Test hook: replace the redirect (pass nothing to restore it). */
export function setSessionExpiredHandler(handler?: SessionExpiredHandler): void {
  sessionExpiredHandler = handler ?? redirectToLogin;
  redirecting = false;
}
