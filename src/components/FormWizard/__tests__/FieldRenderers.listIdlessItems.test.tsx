import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

/**
 * KNG-134: two id-less items in a List field (unsaved values from an old draft) shared
 * key=undefined, so "remove" dropped both and "Edit instance" always opened the first.
 */

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: () => <div data-testid="paged-table">paged-table</div>
}));

const districtsField: FormFieldDto = {
    fieldName: 'Districts',
    label: 'Districts',
    fieldType: FieldType.List,
    elementType: FieldType.Object,
    objectType: 'District',
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
} as FormFieldDto;

const NORTH = { name: 'North' };
const SOUTH = { name: 'South' };

describe('ListField with id-less items (KNG-134)', () => {
    it('opens Edit instance for the item clicked, with its own position', () => {
        const onEditInstance = jest.fn();
        render(<FieldRenderer field={districtsField} value={[NORTH, SOUTH]} onChange={jest.fn()} onEditInstance={onEditInstance} />);

        fireEvent.click(screen.getAllByRole('button', { name: /edit instance/i })[1]);

        expect(onEditInstance).toHaveBeenCalledWith(SOUTH, 1);
    });

    it('removes only the item clicked', () => {
        const onChange = jest.fn();
        render(<FieldRenderer field={districtsField} value={[NORTH, SOUTH]} onChange={onChange} />);

        fireEvent.click(screen.getAllByTitle('Remove from selection')[0]);

        expect(onChange).toHaveBeenCalledWith([SOUTH]);
    });

    it('shows both items and says they are not saved yet', () => {
        render(<FieldRenderer field={districtsField} value={[NORTH, SOUTH, { id: 4, name: 'East' }]} onChange={jest.fn()} />);

        expect(screen.getByText('North')).toBeInTheDocument();
        expect(screen.getByText('South')).toBeInTheDocument();
        expect(screen.getAllByText('Not saved yet')).toHaveLength(2);
        expect(screen.getByText('ID: 4')).toBeInTheDocument();
    });
});
