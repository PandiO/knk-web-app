import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ClaimCodeInput, claimCodeMaskRest, formatClaimCodeField } from '../ClaimCodeInput';
import { CLAIM_CODE_MASK, CLAIM_CODE_SEPARATOR } from '../../../utils/claimCode';

/** A labelled field holding its code in state, as the pages do; `codes` records every change. */
function Field({ initial = '', fold, codes }: { initial?: string; fold?: boolean; codes?: string[] }) {
  const [code, setCode] = useState(initial);
  return (
    <>
      <label htmlFor="code">Code from the server</label>
      <ClaimCodeInput
        id="code"
        value={code}
        foldLookAlikes={fold}
        onChange={next => {
          codes?.push(next);
          setCode(next);
        }}
      />
    </>
  );
}

const field = () => screen.getByLabelText('Code from the server') as HTMLInputElement;

describe('ClaimCodeInput (#192)', () => {
  it('shows the separator itself once the first group is full', async () => {
    const codes: string[] = [];
    render(<Field codes={codes} />);

    await userEvent.type(field(), 'k7qh');
    expect(field()).toHaveValue('K7QH-');
    await userEvent.type(field(), 'm2xa');
    expect(field()).toHaveValue('K7QH-M2XA');
    // The page only ever gets the 8 characters.
    expect(codes[codes.length - 1]).toBe('K7QHM2XA');
    expect(codes.every(code => !code.includes('-'))).toBe(true);
  });

  it('ignores a separator the player types anyway', async () => {
    render(<Field />);

    await userEvent.type(field(), 'k7qh-m2xa');

    expect(field()).toHaveValue('K7QH-M2XA');
  });

  it.each([
    ['K7QH-M2XA'],
    ['K7QHM2XA'],
    ['k7qh m2xa'],
    ['  K7QH – M2XA '],
  ])('lands a pasted %p the same way', async pasted => {
    render(<Field />);

    await userEvent.click(field());
    await userEvent.paste(pasted);

    expect(field()).toHaveValue('K7QH-M2XA');
  });

  it('folds the look-alikes by default, and keeps them for a field that takes link codes too', async () => {
    const { unmount } = render(<Field />);
    await userEvent.type(field(), 'kOqhm2xl');
    expect(field()).toHaveValue('K0QH-M2X1');
    unmount();

    render(<Field fold={false} />);
    await userEvent.type(field(), 'abcdolil');
    expect(field()).toHaveValue('ABCD-OLIL');
  });

  it('stops at 8 characters', async () => {
    render(<Field />);

    await userEvent.type(field(), 'k7qhm2xa99');

    expect(field()).toHaveValue('K7QH-M2XA');
  });

  it('Backspace right after the separator removes the character before it', async () => {
    const codes: string[] = [];
    render(<Field initial="K7QHM2XA" codes={codes} />);
    const input = field();
    input.focus();
    input.setSelectionRange(5, 5); // K7QH-|M2XA

    await userEvent.keyboard('{Backspace}');

    expect(input).toHaveValue('K7QM-2XA');
    expect(codes).toEqual(['K7QM2XA']);
    expect(input.selectionStart).toBe(3); // K7Q|M-2XA
  });

  it('Backspace at the end of a full first group goes back across the separator', async () => {
    render(<Field />);

    await userEvent.type(field(), 'k7qh');
    expect(field()).toHaveValue('K7QH-');
    await userEvent.keyboard('{Backspace}');
    expect(field()).toHaveValue('K7Q');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}');
    expect(field()).toHaveValue('');
  });

  it('Delete right before the separator removes the character after it', async () => {
    render(<Field initial="K7QHM2XA" />);
    const input = field();
    input.focus();
    input.setSelectionRange(4, 4); // K7QH|-M2XA

    await userEvent.keyboard('{Delete}');

    expect(input).toHaveValue('K7QH-2XA');
  });

  it('keeps the caret where it was when a character is typed in the middle', async () => {
    render(<Field initial="K7QM2XA" />);
    const input = field();
    input.focus();
    input.setSelectionRange(3, 3); // K7Q|M-2XA

    await userEvent.keyboard('h');

    expect(input).toHaveValue('K7QH-M2XA');
    // After the H and the separator that moved behind it.
    expect(input.selectionStart).toBe(5);
  });

  it('passes the label, description and other input attributes through', () => {
    render(
      <>
        <label htmlFor="c">Code</label>
        <ClaimCodeInput id="c" value="" onChange={jest.fn()} aria-describedby="help" autoComplete="one-time-code" />
      </>,
    );
    const input = screen.getByLabelText('Code');
    expect(input).toHaveAttribute('aria-describedby', 'help');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    // #196: the mask shows the shape instead of an example code.
    expect(input).not.toHaveAttribute('placeholder');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('formats what the field shows', () => {
    expect(formatClaimCodeField('')).toBe('');
    expect(formatClaimCodeField('K7Q')).toBe('K7Q');
    expect(formatClaimCodeField('K7QH')).toBe('K7QH-');
    expect(formatClaimCodeField('K7QHM2XA')).toBe('K7QH-M2XA');
  });

  describe('mask with the separator from the start (#196)', () => {
    const mask = () => screen.getByTestId('claim-code-mask');
    /** What the mask draws (the typed part is only a placeholder for its width). */
    const maskShows = () => {
      const typed = mask().querySelector('.invisible')?.textContent ?? '';
      return { typed, rest: (mask().textContent ?? '').slice(typed.length) };
    };

    it('shows every slot and the separator while the field is empty', () => {
      render(<Field />);

      expect(CLAIM_CODE_MASK).toBe(`____${CLAIM_CODE_SEPARATOR}____`);
      expect(maskShows()).toEqual({ typed: '', rest: '____-____' });
      expect(mask()).toHaveAttribute('aria-hidden', 'true');
      expect(mask()).toHaveClass('pointer-events-none');
      // The separator is drawn in the text colour, the empty slots muted.
      expect(mask().querySelectorAll('[data-mask-separator]')).toHaveLength(1);
      expect(mask().querySelectorAll('.text-gray-400')).toHaveLength(8);
    });

    it('keeps the separator visible while the first four characters are typed', async () => {
      render(<Field />);

      await userEvent.type(field(), 'k');
      expect(field()).toHaveValue('K');
      expect(maskShows()).toEqual({ typed: 'K', rest: '___-____' });
      await userEvent.type(field(), '7q');
      expect(maskShows()).toEqual({ typed: 'K7Q', rest: '_-____' });
      await userEvent.type(field(), 'h');
      // From here the field holds the separator itself; the mask shows the slots left.
      expect(field()).toHaveValue('K7QH-');
      expect(maskShows()).toEqual({ typed: 'K7QH-', rest: '____' });
      await userEvent.type(field(), 'm2xa');
      expect(maskShows()).toEqual({ typed: 'K7QH-M2XA', rest: '' });
    });

    it('follows Backspace back across the separator', async () => {
      render(<Field initial="K7QHM" />);
      const input = field();
      input.focus();
      input.setSelectionRange(6, 6);

      await userEvent.keyboard('{Backspace}{Backspace}');

      expect(input).toHaveValue('K7Q');
      expect(maskShows()).toEqual({ typed: 'K7Q', rest: '_-____' });
    });

    it('keeps the code when the same code is pasted without its separator over the whole field', async () => {
      const codes: string[] = [];
      render(<Field initial="K7QHM2XA" codes={codes} />);
      const input = field();
      // An earlier Backspace must not make the paste look like a deleted separator.
      fireEvent.keyDown(input, { key: 'Backspace' });
      // userEvent.paste cuts the text to maxLength minus the current length, ignoring the
      // selection it replaces, so the browser's input event is sent directly.
      fireEvent.input(input, { target: { value: 'K7QHM2XA' }, inputType: 'insertFromPaste' });

      expect(input).toHaveValue('K7QH-M2XA');
      expect(codes).toEqual([]);

      // A real Backspace on the separator still removes the character before it.
      input.setSelectionRange(5, 5);
      fireEvent.input(input, { target: { value: 'K7QHM2XA', selectionStart: 4 }, inputType: 'deleteContentBackward' });
      expect(codes).toEqual(['K7QM2XA']);
    });

    it('follows a pasted code', async () => {
      render(<Field />);

      await userEvent.click(field());
      await userEvent.paste('k7qh m2');

      expect(field()).toHaveValue('K7QH-M2');
      expect(maskShows()).toEqual({ typed: 'K7QH-M2', rest: '__' });
    });

    it('gives a caller\'s own placeholder the empty field instead of the mask', async () => {
      render(
        <>
          <label htmlFor="c">Code</label>
          <ClaimCodeInput id="c" value="" onChange={jest.fn()} placeholder="Your code" />
        </>,
      );

      expect(screen.getByLabelText('Code')).toHaveAttribute('placeholder', 'Your code');
      expect(screen.queryByTestId('claim-code-mask')).not.toBeInTheDocument();
    });

    it('computes the rest of the mask from what the field shows', () => {
      expect(claimCodeMaskRest('')).toBe('____-____');
      expect(claimCodeMaskRest('AB')).toBe('__-____');
      expect(claimCodeMaskRest('ABCD-')).toBe('____');
      expect(claimCodeMaskRest('ABCD-EFGH')).toBe('');
    });
  });

  it('does not report a change when only the separator was typed', () => {
    const onChange = jest.fn();
    render(<ClaimCodeInput aria-label="Code" value="K7QH" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'K7QH--' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Code')).toHaveValue('K7QH-');
  });
});
