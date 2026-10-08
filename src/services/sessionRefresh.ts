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
 * POST Auth/refresh with the HttpOnly refresh cookie, and store the new access token. Resolves
 * false when the session is gone (401) or the call fails; never throws.
 */
async function requestNewAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${ConfigurationHelper.gatewayApiUrl}/Auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) {
      return false;
    }
    const body = await response.json().catch(() => null);
    if (!body || typeof body.accessToken !== "string" || !body.accessToken) {
      return false;
    }
    tokenService.setAccessToken(body.accessToken, tokenService.isRemembered());
    return true;
  } catch {
    return false;
  }
}

/**
 * The only way the app refreshes a session. The API rotates the refresh token on every use and
 * treats a reused one as stolen (it ends the whole session), so parallel 401s must share one
 * refresh.
 */
export const refreshAccessToken = singleFlight(requestNewAccessToken);

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
