import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// PandiO/knk-workspace#187 (X-5): the wizard's number and date fields are found by their label (the label
// had no htmlFor or the input no id), and an error marks them invalid.

const baseField = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
    fieldName: 'value',
    label: 'Value',
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
});

describe('FieldRenderer labels (#187)', () => {
    it.each([
        [FieldType.Integer, 'population', 'Population', 'spinbutton'],
        [FieldType.Decimal, 'taxRate', 'Tax rate', 'spinbutton'],
    ])('ties the %s label to its input', (fieldType, fieldName, label, role) => {
        render(<FieldRenderer field={baseField({ fieldType, fieldName, label })} value={null} onChange={jest.fn()} error="Too low" />);
        const input = screen.getByRole(role, { name: label });
        expect(input).toHaveAttribute('id', fieldName);
        expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('ties the DateTime label to its input', () => {
        render(<FieldRenderer field={baseField({ fieldType: FieldType.DateTime, fieldName: 'foundedAt', label: 'Founded' })} value="" onChange={jest.fn()} />);
        const input = screen.getByLabelText('Founded');
        expect(input).toHaveAttribute('type', 'datetime-local');
        expect(input).not.toHaveAttribute('aria-invalid');
    });
});
