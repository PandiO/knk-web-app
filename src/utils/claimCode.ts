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

/**
 * Typed the way the disconnect screen shows it, XXXX-XXXX: the dash is what tells a claim code from
 * an /account link code (8 characters, no dash) when one is typed into the other's field.
 */
export function looksLikeClaimCode(raw: string): boolean {
  return /^[0-9A-Za-z]{4}\s?[-\u2013\u2014]\s?[0-9A-Za-z]{4}$/.test(raw.trim());
}

/**
 * Could these 8 link-code characters be a claim code typed without its dash? Crockford base32 has
 * no I, L, O or U, so a code with one of them is certainly not a claim code. A hint, not a verdict.
 */
export function couldBeClaimCode(normalizedCode: string): boolean {
  return normalizedCode.length === CLAIM_CODE_LENGTH && !/[ILOU]/.test(normalizedCode);
}

/** Said on every claim-code refusal (a tester thought a rejected code was used up, 2026-10-25). */
export const CLAIM_CODE_STAYS_VALID =
  'The same code stays valid for 15 minutes: join the server again and the screen shows it again, or a new code once it has expired.';

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
