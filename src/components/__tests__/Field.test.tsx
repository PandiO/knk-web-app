import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Field } from '../Field';

// PandiO/knk-workspace#187 (X-5): every label is tied to its control.

describe('Field (#187)', () => {
    it('ties the label to the control with a generated id', () => {
        render(<Field label="Username"><input type="text" /></Field>);
        const input = screen.getByLabelText('Username');
        expect(input.tagName).toBe('INPUT');
        expect(input.id).toMatch(/^field-/);
        expect(input).not.toHaveAttribute('aria-describedby');
        expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('gives two fields different ids', () => {
        render(<><Field label="One"><input /></Field><Field label="Two"><select><option>a</option></select></Field></>);
        expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
    });

    it('reads the hint and the error with the control and marks it invalid', () => {
        render(<Field label="Locked Time (ticks)" hint="0–24000" error="Whole number required."><input /></Field>);
        const input = screen.getByLabelText('Locked Time (ticks)');
        expect(input).toHaveAccessibleDescription('0–24000 Whole number required.');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('Whole number required.');
    });

    it('marks a required field and its control', () => {
        render(<Field label="Name" required><input /></Field>);
        const input = screen.getByRole('textbox', { name: 'Name' });
        expect(input).toBeRequired();
        // The star is for the eye; the control's required state is what a screen reader hears.
        expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps an id the control or the caller gives, and the control\'s own description', () => {
        render(
            <>
                <Field label="Fixed" id="townName" hint="Shown in chat"><input aria-describedby="extra" /></Field>
                <p id="extra">Extra</p>
                <Field label="Own id"><textarea id="mine" /></Field>
            </>
        );
        const fixed = screen.getByLabelText('Fixed');
        expect(fixed.id).toBe('townName');
        expect(fixed).toHaveAttribute('aria-describedby', 'extra townName-hint');
        expect(screen.getByLabelText('Own id').id).toBe('mine');
    });

    it('passes the props to a render function', () => {
        render(
            <Field label="Clear weight" error="Too high">
                {control => <div className="relative"><input type="number" {...control} /><span>%</span></div>}
            </Field>
        );
        const input = screen.getByLabelText('Clear weight');
        expect(input).toHaveAttribute('type', 'number');
        expect(input).toHaveAccessibleDescription('Too high');
    });

    it('puts a checkbox before its label with inline', () => {
        const { container } = render(<Field label="Currently online only" inline><input type="checkbox" /></Field>);
        const box = screen.getByRole('checkbox', { name: 'Currently online only' });
        const row = container.querySelector('.flex')!;
        expect(row.firstElementChild).toBe(box);
        expect(row.lastElementChild?.tagName).toBe('LABEL');
    });

    it('shows a unit next to the control and reads it with it (#26)', () => {
        render(
            <Field label="Respawn delay" unit="ticks" hint="= 1 s">
                <input type="text" />
            </Field>
        );
        const input = screen.getByLabelText('Respawn delay');
        expect(screen.getByText('ticks')).toBeInTheDocument();
        expect(input).toHaveAccessibleDescription('ticks = 1 s');
    });

    it('leaves the unit out of inline fields', () => {
        render(
            <Field label="On" unit="ticks" inline>
                <input type="checkbox" />
            </Field>
        );
        expect(screen.queryByText('ticks')).not.toBeInTheDocument();
    });
});
