import React, { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

/**
 * The shape of a code the field shows (#192, #208): groups of letters and digits with a separator
 * between them that the field draws itself, optionally after a fixed prefix (`KNK-` for invitation codes).
 */
export interface SegmentedCodeFormat {
  /** Characters per group, e.g. [4, 4] for XXXX-XXXX. */
  groups: readonly number[];
  separator: string;
  /** One empty slot in the mask. */
  slot: string;
  /** Shown before the code and never part of the value; the player can't type over it. */
  prefix?: string;
  /** The code characters of what was typed or pasted (upper case, no separators, at most the full length). */
  chars: (typed: string) => string;
}

type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'>;

export interface SegmentedCodeInputProps extends NativeProps {
  format: SegmentedCodeFormat;
  /** The code's characters, without separators or prefix. */
  value: string;
  onChange: (code: string) => void;
  /** Classes for the wrapper, e.g. `flex-1` in a row (the input's own classes go in `className`). */
  containerClassName?: string;
}

/** Positions in the code where a group ends and a separator follows (not after the last group). */
function groupEnds(format: SegmentedCodeFormat): number[] {
  const ends: number[] = [];
  let total = 0;
  format.groups.slice(0, -1).forEach(length => {
    total += length;
    ends.push(total);
  });
  return ends;
}

export function codeLength(format: SegmentedCodeFormat): number {
  return format.groups.reduce((sum, length) => sum + length, 0);
}

/** What the field shows: the groups so far, each separator as soon as the group before it is full. */
export function formatSegmentedField(format: SegmentedCodeFormat, code: string): string {
  let shown = '';
  let start = 0;
  format.groups.forEach((length, index) => {
    shown += code.slice(start, start + length);
    start += length;
    if (index < format.groups.length - 1 && code.length >= start) shown += format.separator;
  });
  return shown;
}

/** The whole mask: `____-____` for claim codes. */
export function segmentedMask(format: SegmentedCodeFormat): string {
  return format.groups.map(length => format.slot.repeat(length)).join(format.separator);
}

/** The part of the mask still to fill after what the field shows (#196). */
export function segmentedMaskRest(format: SegmentedCodeFormat, shown: string): string {
  const mask = segmentedMask(format);
  return mask.slice(Math.min(shown.length, mask.length));
}

/** Where code position `index` is in the shown text (after every separator already shown before it). */
function fieldIndex(format: SegmentedCodeFormat, code: string, index: number): number {
  const separators = groupEnds(format).filter(end => index >= end && code.length >= end).length;
  return index + separators * format.separator.length;
}

const countCodeChars = (text: string) => text.replace(/[^A-Za-z0-9]/g, '').length;

/** The input's text box, copied onto the mask so its slots sit exactly under the typed characters. */
const MIRRORED_STYLES = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textTransform',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

/**
 * One labelled text field for a code in groups (#192, generalised in #208): it shows the separators
 * between the groups itself, so the code looks the same as where the player read it and the player
 * never types them. Typing or pasting flows across a separator (`ABCD-EFGH`, `ABCDEFGH` and `abcd efgh`
 * all land the same), the caret stays where it was, and Backspace or Delete on a separator removes the
 * character beyond it. A single input (not one box per group) keeps it simple for screen readers and
 * password managers. The caller gives the `id` its label points at.
 *
 * #196: a mask over the field shows the slots still to fill and the separators from the start
 * (`____-____`, then `K7__-____`), so the dash is visibly there before the group is full. The mask is
 * decoration only (aria-hidden, no pointer events); the input's value is still just what was typed
 * plus the separators of full groups, so paste, autofill and the caret work as before. It lines up
 * with the typed text because it copies the input's font, letter spacing, padding and border widths.
 * A caller's own `placeholder` replaces the mask while the field is empty.
 *
 * #206: the code and its mask are centered in the field.
 *
 * #208: an optional fixed prefix (`KNK-`) is drawn by the mask in front of the slots; the input's
 * text starts after it, and it is never part of the value, so it can't be deleted or typed over.
 */
export const SegmentedCodeInput = forwardRef<HTMLInputElement, SegmentedCodeInputProps>(function SegmentedCodeInput(
  { format, value, onChange, onKeyDown, className, containerClassName, placeholder, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const maskRef = useRef<HTMLSpanElement>(null);
  const maskTextRef = useRef<HTMLSpanElement>(null);
  const prefixRef = useRef<HTMLSpanElement>(null);
  const lastKey = useRef<string | null>(null);
  const pendingCaret = useRef<number | null>(null);
  // Bumped on every change, so the caret is put back even when the code itself didn't change
  // (a typed separator, a deleted separator at the end): React then resets the text to `shown`.
  const [changeCount, setChangeCount] = useState(0);
  const shown = formatSegmentedField(format, value);
  const maskRest = segmentedMaskRest(format, shown);
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
  // #206: the whole `____-____` is centered in the field; the input's text starts at the same
  // offset (text-indent), so the typed characters stay on their slots.
  const alignMask = useCallback(() => {
    const input = inputRef.current;
    const mask = maskRef.current;
    if (!input) return;
    if (!mask) {
      input.style.textIndent = '';
      return;
    }
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
    const text = maskTextRef.current;
    if (text) {
      const box = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const offset = Math.max(0, Math.floor((box - text.offsetWidth) / 2));
      const indent = offset + (prefixRef.current?.offsetWidth ?? 0);
      text.style.marginLeft = offset ? `${offset}px` : '';
      input.style.textIndent = indent ? `${indent}px` : '';
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

  // Re-center as the text changes (a proportional font) and when the mask comes or goes.
  useLayoutEffect(alignMask, [shown, showMask, alignMask]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value;
    const caretInTyped = event.target.selectionStart ?? typed.length;
    let next = format.chars(typed);
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

    pendingCaret.current = fieldIndex(format, next, caret);
    setChangeCount(count => count + 1);
    if (next !== value) onChange(next);
  };

  return (
    <span className={`relative block ${containerClassName ?? ''}`.trim()}>
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
        // Room for a pasted code with its prefix and spaces or dashes around the separators; the extra is dropped.
        maxLength={((format.prefix?.length ?? 0) + codeLength(format)) * 2}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={className}
      />
      {showMask && (
        <span
          ref={maskRef}
          aria-hidden="true"
          data-testid="code-mask"
          className="pointer-events-none absolute inset-0 flex select-none items-center overflow-hidden whitespace-pre border-solid border-transparent"
        >
          <span ref={maskTextRef} className="block">
            {format.prefix && <span ref={prefixRef} data-mask-prefix="">{format.prefix}</span>}
            {/* The typed part only holds the place; the input itself draws those characters. */}
            <span className="invisible">{shown}</span>
            {Array.from(maskRest).map((char, index) =>
              char === format.separator
                ? <span key={index} data-mask-separator="">{char}</span>
                : <span key={index} className="text-gray-400">{char}</span>,
            )}
          </span>
        </span>
      )}
    </span>
  );
});
