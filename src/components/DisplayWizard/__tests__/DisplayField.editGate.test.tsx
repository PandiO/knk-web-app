import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayField } from '../DisplayField';
import { DisplayFieldDto } from '../../../types/dtos/displayConfig/DisplayModels';

// PandiO/knk-workspace#383: a hot edit saves through the type's PUT, which #374 gates on knk.admin.content.

const editable: DisplayFieldDto = {
    label: 'Name', fieldName: 'name', fieldType: 'String', isEditableInDisplay: true, isReusable: false, isLinkedToSource: false,
};

describe('DisplayField hot edit gate (#383)', () => {
    it('greys the pencil out with the hint when the gate says no', () => {
        const onValueChange = jest.fn();
        render(<dl><DisplayField field={editable} data={{ name: 'Cinix' }} onValueChange={onValueChange}
            editGate={{ allowed: false, hint: 'Requires knk.admin.content' }} /></dl>);
        const pencil = screen.getByRole('button', { name: 'Edit Name – Requires knk.admin.content' });
        expect(pencil).toBeDisabled();
        expect(pencil).toHaveAttribute('title', 'Requires knk.admin.content');
        fireEvent.click(pencil);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('keeps the pencil disabled without a hint while the check runs', () => {
        render(<dl><DisplayField field={editable} data={{ name: 'Cinix' }} onValueChange={jest.fn()}
            editGate={{ allowed: false, hint: null }} /></dl>);
        expect(screen.getByRole('button', { name: 'Edit Name' })).toBeDisabled();
    });

    it('opens the editor when allowed', () => {
        render(<dl><DisplayField field={editable} data={{ name: 'Cinix' }} onValueChange={jest.fn()}
            editGate={{ allowed: true, hint: null }} /></dl>);
        fireEvent.click(screen.getByRole('button', { name: 'Edit Name' }));
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Cinix');
    });
});
