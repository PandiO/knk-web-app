import { Subject } from 'rxjs';
import ConfigurationHelper from '../utils/config-helper';
import { readOnboardingInfo } from '../utils/onboardingInfoCache';

/**
 * Recognising "no Cloudflare Access session" (2026-10-25). The alpha site sits behind Cloudflare
 * Access; an API call from a browser without a session is answered with a redirect to Cloudflare's
 * login, which the browser refuses to follow for a cross-origin fetch, so the app only sees a network
 * failure and used to say "Network error" or "Linking failed". When a request fails without a
 * response and the onboarding info says the gate is on, one probe tells the two apart: a document-like
 * fetch of the anonymous health endpoint with `redirect: 'manual'` comes back as an opaque redirect
 * when Cloudflare is in the way. The result is announced app-wide (the banner with "Sign in with
 * Cloudflare", which reloads the page as a document request) and marked on the error itself.
 */
export const CLOUDFLARE_SESSION_CODE = 'CloudflareSession';

export const CLOUDFLARE_SESSION_MESSAGE =
  "Your Cloudflare sign-in has expired or isn't active on this device. Sign in with Cloudflare to continue.";

export class CloudflareSessionError extends Error {
  readonly code = CLOUDFLARE_SESSION_CODE;

  constructor(readonly cause?: unknown) {
    super(CLOUDFLARE_SESSION_MESSAGE);
    this.name = 'CloudflareSessionError';
  }
}

export const isCloudflareSessionError = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === CLOUDFLARE_SESSION_CODE;

/** Fires `true` when a missing session was detected, `false` when the page is reloading for it. */
export const cloudflareSessionMissing = new Subject<boolean>();

/** How long one probe's verdict is reused, so a burst of failing calls doesn't probe over and over. */
const PROBE_TTL_MS = 10_000;
let lastProbe: { at: number; missing: boolean } | null = null;
let probeInFlight: Promise<boolean> | null = null;

/** Tests only. */
export function resetCloudflareProbe(): void {
  lastProbe = null;
  probeInFlight = null;
}

/** Is Cloudflare Access in the way? Only asked when the onboarding info says the gate is on. */
export async function probeCloudflareSession(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (lastProbe && Date.now() - lastProbe.at < PROBE_TTL_MS) return lastProbe.missing;
  if (!probeInFlight) {
    probeInFlight = (async () => {
      try {
        const response = await fetchImpl(`${ConfigurationHelper.gatewayApiUrl}/Health`, {
          method: 'GET',
          redirect: 'manual',
          credentials: 'include',
          headers: { Accept: '*/*' },
        });
        const redirected = response.type === 'opaqueredirect'
          || (response.redirected && /cloudflareaccess\.com/i.test(response.url));
        lastProbe = { at: Date.now(), missing: redirected };
        return redirected;
      } catch {
        // The API itself is unreachable: not a Cloudflare problem.
        lastProbe = { at: Date.now(), missing: false };
        return false;
      } finally {
        probeInFlight = null;
      }
    })();
  }
  return probeInFlight;
}

/**
 * For the service-call layer: a request died without a response. Is that a missing Cloudflare
 * session? Only when the gate is known to be on (the onboarding info is on the bypass list, so it
 * can be fetched without a session); otherwise it's an ordinary network failure.
 */
export async function detectMissingCloudflareSession(
  loadInfo: () => Promise<{ accessGate: boolean } | null>,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const info = readOnboardingInfo() ?? await loadInfo();
  if (!info?.accessGate) return false;
  const missing = await probeCloudflareSession(fetchImpl);
  if (missing) cloudflareSessionMissing.next(true);
  return missing;
}
