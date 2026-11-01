import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InviteCodeInput } from '../InviteCodeInput';

function Field({ codes }: { codes: string[] }) {
  const [code, setCode] = useState('');
  return (
    <>
      <label htmlFor="code">Invitation code</label>
      <InviteCodeInput
        id="code"
        value={code}
        onChange={next => {
          codes.push(next);
          setCode(next);
        }}
      />
    </>
  );
}

const field = () => screen.getByLabelText('Invitation code') as HTMLInputElement;
const mask = () => screen.getByTestId('code-mask');

describe('InviteCodeInput (#208)', () => {
  it('shows KNK- and both dashes from the start', () => {
    render(<Field codes={[]} />);
    expect(mask()).toHaveTextContent('KNK-_____-_____');
    expect(field()).toHaveValue('');
  });

  it('draws the dash itself while typing; the value is only the 10 characters', async () => {
    const codes: string[] = [];
    render(<Field codes={codes} />);
    await userEvent.type(field(), '7qh4m');
    expect(field()).toHaveValue('7QH4M-');
    expect(mask()).toHaveTextContent('KNK-7QH4M-_____');
    await userEvent.type(field(), '2xa9p');
    expect(field()).toHaveValue('7QH4M-2XA9P');
    expect(codes[codes.length - 1]).toBe('7QH4M2XA9P');
  });

  it.each(['KNK-7QH4M-2XA9P', 'knk7qh4m2xa9p', '7QH4M-2XA9P', '7QH4M2XA9P'])('takes a pasted %s', async pasted => {
    const codes: string[] = [];
    render(<Field codes={codes} />);
    field().focus();
    await userEvent.paste(pasted);
    expect(field()).toHaveValue('7QH4M-2XA9P');
    expect(codes[codes.length - 1]).toBe('7QH4M2XA9P');
  });

  it('takes KNK typed by habit', async () => {
    render(<Field codes={[]} />);
    await userEvent.type(field(), 'knk-7qh4m-2xa9p');
    expect(field()).toHaveValue('7QH4M-2XA9P');
  });

  it('Backspace on the dash removes the character before it', async () => {
    render(<Field codes={[]} />);
    await userEvent.type(field(), '7qh4m');
    await userEvent.type(field(), '{backspace}');
    expect(field()).toHaveValue('7QH4');
  });
});
