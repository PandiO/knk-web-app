/** Link codes from `/account link` are 8 characters, A-Z and 0-9 (the API ignores hyphens and case). */
export const LINK_CODE_LENGTH = 8;

/** Uppercase, letters and digits only, at most LINK_CODE_LENGTH characters. */
export function normalizeLinkCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LINK_CODE_LENGTH);
}
