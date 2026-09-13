import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

const baseField = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
    fieldName: 'isActive',
    label: 'Activate gate immediately',
    fieldType: FieldType.Boolean,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
});

describe('FieldRenderer Boolean field', () => {
    it('renders unchecked for an untouched field whose raw default is the string "false"', () => {
        render(
            <FieldRenderer
                field={baseField({ defaultValue: 'false' })}
                value="false"
                onChange={jest.fn()}
            />
        );

        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('renders checked for the string "true"', () => {
        render(
            <FieldRenderer
                field={baseField({ defaultValue: 'true' })}
                value="true"
                onChange={jest.fn()}
            />
        );

        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('reports the new value as a real boolean when toggled', () => {
        const onChange = jest.fn();
        render(
            <FieldRenderer
                field={baseField({ defaultValue: 'false' })}
                value="false"
                onChange={onChange}
            />
        );

        fireEvent.click(screen.getByRole('checkbox'));

        expect(onChange).toHaveBeenCalledWith(true);
    });
});
