import React, { forwardRef, useMemo } from 'react';
import {
  CLAIM_CODE_GROUP_LENGTH,
  CLAIM_CODE_LENGTH,
  CLAIM_CODE_SEPARATOR,
  CLAIM_CODE_SLOT,
  claimCodeChars,
} from '../../utils/claimCode';
import {
  SegmentedCodeFormat,
  SegmentedCodeInputProps,
  SegmentedCodeInput,
  formatSegmentedField,
  segmentedMaskRest,
} from './SegmentedCodeInput';

export interface ClaimCodeInputProps extends Omit<SegmentedCodeInputProps, 'format'> {
  /**
   * Fold the look-alikes O→0 and I/L→1 while typing (default). Off for a field that takes an
   * /account link code as well: its alphabet has those letters, and the API folds a claim code itself.
   */
  foldLookAlikes?: boolean;
}

const claimCodeFormat = (foldLookAlikes: boolean): SegmentedCodeFormat => ({
  groups: [CLAIM_CODE_GROUP_LENGTH, CLAIM_CODE_LENGTH - CLAIM_CODE_GROUP_LENGTH],
  separator: CLAIM_CODE_SEPARATOR,
  slot: CLAIM_CODE_SLOT,
  chars: typed => claimCodeChars(typed, foldLookAlikes),
});

const FOLDING = claimCodeFormat(true);

/** What the field shows: the first group, then the separator as soon as the first group is full. */
export function formatClaimCodeField(code: string): string {
  return formatSegmentedField(FOLDING, code);
}

/**
 * The part of the mask still to fill after what the field shows (#196): `____-____` while empty,
 * `__-____` after two characters, `____` once the first group and the separator are there.
 */
export function claimCodeMaskRest(shown: string): string {
  return segmentedMaskRest(FOLDING, shown);
}

/**
 * The claim code field (#192, #196, #206): XXXX-XXXX with the dash drawn by the field, on /link and
 * /account. See SegmentedCodeInput for how typing, pasting and the mask work.
 */
export const ClaimCodeInput = forwardRef<HTMLInputElement, ClaimCodeInputProps>(function ClaimCodeInput(
  { foldLookAlikes = true, ...rest },
  ref,
) {
  const format = useMemo(() => claimCodeFormat(foldLookAlikes), [foldLookAlikes]);
  return <SegmentedCodeInput ref={ref} format={format} {...rest} />;
});
