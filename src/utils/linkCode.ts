/** Link codes from `/account link` are 8 characters, A-Z and 0-9 (the API ignores hyphens and case). */
export const LINK_CODE_LENGTH = 8;

/** Uppercase, letters and digits only, at most LINK_CODE_LENGTH characters. */
export function normalizeLinkCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LINK_CODE_LENGTH);
}

/**
 * What the code field shows while typing: upper case, letters, digits and at most one dash, so a
 * claim code pasted or typed as XXXX-XXXX keeps the dash that identifies it (`looksLikeClaimCode`).
 */
export function normalizeLinkCodeInput(value: string): string {
  const upper = value.toUpperCase().replace(/[\u2013\u2014]/g, '-').replace(/[^A-Z0-9-]/g, '');
  const firstDash = upper.indexOf('-');
  const oneDash = firstDash < 0 ? upper : upper.slice(0, firstDash + 1) + upper.slice(firstDash + 1).replace(/-/g, '');
  return oneDash.slice(0, LINK_CODE_LENGTH + (oneDash.includes('-') ? 1 : 0));
}
