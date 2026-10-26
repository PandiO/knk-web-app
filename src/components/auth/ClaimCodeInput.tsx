import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  CLAIM_CODE_EXAMPLE,
  CLAIM_CODE_GROUP_LENGTH,
  CLAIM_CODE_LENGTH,
  CLAIM_CODE_SEPARATOR,
  claimCodeChars,
} from '../../utils/claimCode';

type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'>;

export interface ClaimCodeInputProps extends NativeProps {
  /** The code's characters, without the separator (what the API gets). */
  value: string;
  onChange: (code: string) => void;
  /**
   * Fold the look-alikes O→0 and I/L→1 while typing (default). Off for a field that takes an
   * /account link code as well: its alphabet has those letters, and the API folds a claim code itself.
   */
  foldLookAlikes?: boolean;
}

/** What the field shows: the first group, then the separator as soon as the first group is full. */
export function formatClaimCodeField(code: string): string {
  return code.length >= CLAIM_CODE_GROUP_LENGTH
    ? `${code.slice(0, CLAIM_CODE_GROUP_LENGTH)}${CLAIM_CODE_SEPARATOR}${code.slice(CLAIM_CODE_GROUP_LENGTH)}`
    : code;
}

/** Where code position `index` is in the shown text (after the separator from the second group on). */
function fieldIndex(code: string, index: number): number {
  return index >= CLAIM_CODE_GROUP_LENGTH && code.length >= CLAIM_CODE_GROUP_LENGTH
    ? index + CLAIM_CODE_SEPARATOR.length
    : index;
}

const countCodeChars = (text: string) => text.replace(/[^A-Za-z0-9]/g, '').length;

/**
 * One labelled text field for a claim code (#192): it shows the separator between the two groups
 * of 4 itself, so the code looks the same as on the disconnect screen and the player never types it.
 * Typing or pasting flows across the separator (`ABCD-EFGH`, `ABCDEFGH` and `abcd efgh` all land the
 * same), the caret stays where it was, and Backspace or Delete on the separator removes the character
 * beyond it. A single input (not two boxes) keeps it simple for screen readers and password managers.
 * The caller gives the `id` its label points at.
 */
export const ClaimCodeInput = forwardRef<HTMLInputElement, ClaimCodeInputProps>(function ClaimCodeInput(
  { value, onChange, foldLookAlikes = true, onKeyDown, className, placeholder, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const lastKey = useRef<string | null>(null);
  const pendingCaret = useRef<number | null>(null);
  // Bumped on every change, so the caret is put back even when the code itself didn't change
  // (a typed separator, a deleted separator at the end): React then resets the text to `shown`.
  const [changeCount, setChangeCount] = useState(0);
  const shown = formatClaimCodeField(value);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (input && caret !== null && document.activeElement === input) {
      input.setSelectionRange(caret, caret);
    }
  }, [changeCount, shown]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value;
    const caretInTyped = event.target.selectionStart ?? typed.length;
    let next = claimCodeChars(typed, foldLookAlikes);
    let caret = Math.min(countCodeChars(typed.slice(0, caretInTyped)), next.length);

    // Only the separator went (Backspace or Delete on it): remove the character beyond it instead.
    if (next === value && typed.length < shown.length) {
      if (lastKey.current === 'Delete') {
        next = value.slice(0, caret) + value.slice(caret + 1);
      } else if (caret > 0) {
        next = value.slice(0, caret - 1) + value.slice(caret);
        caret -= 1;
      }
    }

    pendingCaret.current = fieldIndex(next, caret);
    setChangeCount(count => count + 1);
    if (next !== value) onChange(next);
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      value={shown}
      onChange={handleChange}
      onKeyDown={event => {
        lastKey.current = event.key;
        onKeyDown?.(event);
      }}
      placeholder={placeholder ?? CLAIM_CODE_EXAMPLE}
      // Room for a pasted code with spaces or dashes around the separator; the extra is dropped.
      maxLength={CLAIM_CODE_LENGTH * 2}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      className={className}
    />
  );
});
