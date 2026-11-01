import React, { forwardRef } from 'react';
import { SegmentedCodeFormat, SegmentedCodeInputProps, SegmentedCodeInput } from './SegmentedCodeInput';
import { INVITE_CODE_GROUPS, INVITE_CODE_PREFIX, INVITE_CODE_SEPARATOR, inviteCodeChars } from '../../utils/inviteCode';
import { CLAIM_CODE_SLOT } from '../../utils/claimCode';

export const INVITE_CODE_FORMAT: SegmentedCodeFormat = {
  groups: INVITE_CODE_GROUPS,
  separator: INVITE_CODE_SEPARATOR,
  slot: CLAIM_CODE_SLOT,
  prefix: `${INVITE_CODE_PREFIX}${INVITE_CODE_SEPARATOR}`,
  chars: inviteCodeChars,
};

/**
 * The invitation code field (#208): `KNK-` fixed in front, then `_____-_____` with the dash drawn by
 * the field. The value is the 10 characters only; send `formatInviteCode(value)`.
 */
export const InviteCodeInput = forwardRef<HTMLInputElement, Omit<SegmentedCodeInputProps, 'format'>>(
  function InviteCodeInput(props, ref) {
    return <SegmentedCodeInput ref={ref} format={INVITE_CODE_FORMAT} {...props} />;
  },
);
