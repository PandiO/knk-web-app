/**
 * A personal invitation token kept for the tab while the player detours through the login page
 * (KNG-212 removes the token from the address bar on /invite/:token, so nothing else remembers it).
 * /invite without a token resumes it; the login page's "Create an account" points back to /invite
 * while one is kept. Cleared once the account exists or the invite turns out invalid.
 */
export interface PendingInvite {
  token: string;
  /** The invited address, for the login page's wording. */
  email?: string | null;
  expiresAt: string;
}

const PENDING_INVITE_KEY = 'knk.pendingInvite';

/** When the invite's own expiry is unknown, keep it for a day at most (the tab usually dies first). */
const DEFAULT_KEEP_MS = 24 * 60 * 60 * 1000;

export function savePendingInvite(invite: { token: string; email?: string | null; expiresAt?: string | null }, now: Date = new Date()): void {
  const expiresAt = invite.expiresAt && !Number.isNaN(Date.parse(invite.expiresAt))
    ? invite.expiresAt
    : new Date(now.getTime() + DEFAULT_KEEP_MS).toISOString();
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ token: invite.token, email: invite.email ?? null, expiresAt }));
  } catch {
    // Storage blocked: the player opens the invitation link again.
  }
}

/** The kept invitation, or null when there is none or it has expired. */
export function loadPendingInvite(now: Date = new Date()): PendingInvite | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const invite = JSON.parse(raw) as Partial<PendingInvite>;
    const expires = invite.expiresAt ? Date.parse(invite.expiresAt) : NaN;
    if (!invite.token || Number.isNaN(expires) || expires <= now.getTime()) {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      return null;
    }
    return { token: invite.token, email: invite.email ?? null, expiresAt: invite.expiresAt! };
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Nothing to clear.
  }
}
