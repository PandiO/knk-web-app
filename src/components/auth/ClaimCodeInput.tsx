import React, { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  CLAIM_CODE_GROUP_LENGTH,
  CLAIM_CODE_LENGTH,
  CLAIM_CODE_MASK,
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

/**
 * The part of the mask still to fill after what the field shows (#196): `____-____` while empty,
 * `__-____` after two characters, `____` once the first group and the separator are there.
 */
export function claimCodeMaskRest(shown: string): string {
  return CLAIM_CODE_MASK.slice(Math.min(shown.length, CLAIM_CODE_MASK.length));
}

/** Where code position `index` is in the shown text (after the separator from the second group on). */
function fieldIndex(code: string, index: number): number {
  return index >= CLAIM_CODE_GROUP_LENGTH && code.length >= CLAIM_CODE_GROUP_LENGTH
    ? index + CLAIM_CODE_SEPARATOR.length
    : index;
}

const countCodeChars = (text: string) => text.replace(/[^A-Za-z0-9]/g, '').length;

/** The input's text box, copied onto the mask so its slots sit exactly under the typed characters. */
const MIRRORED_STYLES = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textTransform',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

/**
 * One labelled text field for a claim code (#192): it shows the separator between the two groups
 * of 4 itself, so the code looks the same as on the disconnect screen and the player never types it.
 * Typing or pasting flows across the separator (`ABCD-EFGH`, `ABCDEFGH` and `abcd efgh` all land the
 * same), the caret stays where it was, and Backspace or Delete on the separator removes the character
 * beyond it. A single input (not two boxes) keeps it simple for screen readers and password managers.
 * The caller gives the `id` its label points at.
 *
 * #196: a mask over the field shows the slots still to fill and the separator from the start
 * (`____-____`, then `K7__-____`), so the dash is visibly there before the 4th character. The mask is
 * decoration only (aria-hidden, no pointer events); the input's value is still just what was typed
 * plus the separator once the first group is full, so paste, autofill and the caret work as before.
 * It lines up with the typed text because it copies the input's font, letter spacing, padding and
 * border widths. A caller's own `placeholder` replaces the mask while the field is empty.
 */
export const ClaimCodeInput = forwardRef<HTMLInputElement, ClaimCodeInputProps>(function ClaimCodeInput(
  { value, onChange, foldLookAlikes = true, onKeyDown, className, placeholder, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const maskRef = useRef<HTMLSpanElement>(null);
  const maskTextRef = useRef<HTMLSpanElement>(null);
  const lastKey = useRef<string | null>(null);
  const pendingCaret = useRef<number | null>(null);
  // Bumped on every change, so the caret is put back even when the code itself didn't change
  // (a typed separator, a deleted separator at the end): React then resets the text to `shown`.
  const [changeCount, setChangeCount] = useState(0);
  const shown = formatClaimCodeField(value);
  const maskRest = claimCodeMaskRest(shown);
  const showMask = !(placeholder && shown.length === 0);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (input && caret !== null && document.activeElement === input) {
      input.setSelectionRange(caret, caret);
    }
  }, [changeCount, shown]);

  // Follow the text if the input ever scrolls it (a very narrow field).
  const syncScroll = useCallback(() => {
    const input = inputRef.current;
    const text = maskTextRef.current;
    if (input && text) text.style.transform = input.scrollLeft ? `translateX(${-input.scrollLeft}px)` : '';
  }, []);

  // Put the mask exactly over the input's text box: same font and spacing, same place and size.
  const alignMask = useCallback(() => {
    const input = inputRef.current;
    const mask = maskRef.current;
    if (!input || !mask) return;
    const style = window.getComputedStyle(input);
    MIRRORED_STYLES.forEach(property => {
      mask.style[property] = style[property];
    });
    mask.style.color = style.color;
    if (input.offsetWidth > 0) {
      mask.style.left = `${input.offsetLeft}px`;
      mask.style.top = `${input.offsetTop}px`;
      mask.style.width = `${input.offsetWidth}px`;
      mask.style.height = `${input.offsetHeight}px`;
    }
    syncScroll();
  }, [syncScroll]);

  useLayoutEffect(() => {
    alignMask();
    const input = inputRef.current;
    if (!input) return undefined;
    window.addEventListener('resize', alignMask);
    input.addEventListener('scroll', syncScroll);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(alignMask) : null;
    observer?.observe(input);
    return () => {
      window.removeEventListener('resize', alignMask);
      input.removeEventListener('scroll', syncScroll);
      observer?.disconnect();
    };
  }, [alignMask, syncScroll]);

  useLayoutEffect(syncScroll, [shown, syncScroll]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value;
    const caretInTyped = event.target.selectionStart ?? typed.length;
    let next = claimCodeChars(typed, foldLookAlikes);
    let caret = Math.min(countCodeChars(typed.slice(0, caretInTyped)), next.length);

    // Only the separator went (Backspace or Delete on it): remove the character beyond it instead.
    // Only for a deletion: pasting or autofilling the same code without its separator over the
    // whole field also leaves the code unchanged and the text shorter, and must keep the code (#196).
    const inputType = (event.nativeEvent as InputEvent | undefined)?.inputType;
    const deleted = inputType
      ? inputType.startsWith('delete')
      : lastKey.current === 'Backspace' || lastKey.current === 'Delete';
    if (deleted && next === value && typed.length < shown.length) {
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
    <span className="relative block">
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
        placeholder={placeholder}
        // Room for a pasted code with spaces or dashes around the separator; the extra is dropped.
        maxLength={CLAIM_CODE_LENGTH * 2}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={className}
      />
      {showMask && (
        <span
          ref={maskRef}
          aria-hidden="true"
          data-testid="claim-code-mask"
          className="pointer-events-none absolute inset-0 flex select-none items-center overflow-hidden whitespace-pre border-solid border-transparent"
        >
          <span ref={maskTextRef} className="block">
            {/* The typed part only holds the place; the input itself draws those characters. */}
            <span className="invisible">{shown}</span>
            {Array.from(maskRest).map((char, index) =>
              char === CLAIM_CODE_SEPARATOR
                ? <span key={index} data-mask-separator="">{char}</span>
                : <span key={index} className="text-gray-400">{char}</span>,
            )}
          </span>
        </span>
      )}
    </span>
  );
});
