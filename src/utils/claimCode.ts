/**
 * Claim codes from the game server's disconnect screen (KNG-214, invitations DESIGN.md § 5.2):
 * 8 Crockford base32 characters shown as XXXX-XXXX and valid for 15 minutes. The API reads them
 * case-insensitively, without the hyphen, with the look-alikes O→0 and I/L→1.
 */
export const CLAIM_CODE_LENGTH = 8;

/** Upper case, letters and digits only, look-alikes folded, at most CLAIM_CODE_LENGTH characters. */
export function normalizeClaimCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CLAIM_CODE_LENGTH);
}

/** XXXX-XXXX, as on the disconnect screen. */
export function formatClaimCode(code: string): string {
  const normalized = normalizeClaimCode(code);
  return normalized.length > 4 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}

/** A verified claim code kept for its lifetime while the player logs in or signs up (/link). */
export interface PendingClaim {
  code: string;
  minecraftName: string;
  expiresAt: string;
}

const PENDING_CLAIM_KEY = 'knk.pendingClaim';

export function savePendingClaim(claim: PendingClaim): void {
  try {
    sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(claim));
  } catch {
    // Storage blocked: the player types the code again.
  }
}

/** The kept claim code, or null when there is none or it has expired. */
export function loadPendingClaim(now: Date = new Date()): PendingClaim | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CLAIM_KEY);
    if (!raw) return null;
    const claim = JSON.parse(raw) as Partial<PendingClaim>;
    const expires = claim.expiresAt ? Date.parse(claim.expiresAt) : NaN;
    if (!claim.code || !claim.minecraftName || Number.isNaN(expires) || expires <= now.getTime()) {
      sessionStorage.removeItem(PENDING_CLAIM_KEY);
      return null;
    }
    return { code: claim.code, minecraftName: claim.minecraftName, expiresAt: claim.expiresAt! };
  } catch {
    return null;
  }
}

export function clearPendingClaim(): void {
  try {
    sessionStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    // Nothing to clear.
  }
}
