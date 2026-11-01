/**
 * Shared invitation codes (KNG-212, invitations DESIGN.md § 3): `KNK-` plus 10 Crockford base32
 * characters, shown as KNK-XXXXX-XXXXX. The API reads them case-insensitively, ignores the dashes and
 * reads 0/O and 1/I/L the same. The fields (#208) hold only the 10 characters; the pages send the
 * whole code.
 */
export const INVITE_CODE_PREFIX = 'KNK';

export const INVITE_CODE_SEPARATOR = '-';

/** Characters in each group after the prefix. */
export const INVITE_CODE_GROUPS = [5, 5] as const;

export const INVITE_CODE_LENGTH = INVITE_CODE_GROUPS[0] + INVITE_CODE_GROUPS[1];

/** How an invitation code looks, for placeholders and help texts. */
export const INVITE_CODE_SHAPE = `${INVITE_CODE_PREFIX}${INVITE_CODE_SEPARATOR}XXXXX${INVITE_CODE_SEPARATOR}XXXXX`;

/**
 * The 10 code characters of what was typed or pasted: upper case, letters and digits only, the
 * look-alikes folded (Crockford has no O, I or L), and the `KNK` prefix dropped when it came along
 * (`KNK-ABCDE-FGHJK`, `KNKABCDEFGHJK` and `abcde fghjk` all give ABCDEFGHJK). The prefix is only
 * dropped from more than 10 characters, so a code that itself starts with KNK stays whole.
 */
export function inviteCodeChars(value: string): string {
  let chars = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (chars.length > INVITE_CODE_LENGTH && chars.startsWith(INVITE_CODE_PREFIX)) {
    chars = chars.slice(INVITE_CODE_PREFIX.length);
  }
  return chars.replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, INVITE_CODE_LENGTH);
}

/** The whole code for the API and links: KNK-XXXXX-XXXXX (shorter while it is incomplete). */
export function formatInviteCode(chars: string): string {
  const [first] = INVITE_CODE_GROUPS;
  const groups = chars.length > first ? [chars.slice(0, first), chars.slice(first)] : [chars];
  return [INVITE_CODE_PREFIX, ...groups].join(INVITE_CODE_SEPARATOR);
}
