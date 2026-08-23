import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

const baseField = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
    fieldName: 'example',
    label: 'Example',
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

describe('FieldRenderer display options', () => {
    it('renders configured string enum values as a dropdown', () => {
        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'faceDirection',
                    label: 'Facing direction',
                    settingsJson: '{"enumValues":["north","east","south","west"]}'
                })}
                value="north"
                onChange={jest.fn()}
            />
        );

        expect(screen.getByRole('combobox', { name: /facing direction/i })).toHaveValue('north');
        expect(screen.getByRole('option', { name: 'east' })).toBeInTheDocument();
    });

    it('renders configured enum options independently from the default value', () => {
        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'gateType',
                    label: 'Gate type',
                    fieldType: FieldType.Enum,
                    defaultValue: 'SLIDING',
                    settingsJson: '{"enumValues":["SLIDING","TRAP","DRAWBRIDGE","DOUBLE_DOORS"]}'
                })}
                value="SLIDING"
                onChange={jest.fn()}
            />
        );

        expect(screen.getByRole('option', { name: 'TRAP' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'DOUBLE_DOORS' })).toBeInTheDocument();
    });

    it('labels an unselected object picker as Select instance', () => {
        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'streetId',
                    label: 'Street',
                    fieldType: FieldType.Object,
                    objectType: 'Street'
                })}
                value={null}
                onChange={jest.fn()}
            />
        );

        expect(screen.getAllByRole('button', { name: /select instance/i }).length).toBeGreaterThan(0);
    });

    it('labels a populated object picker as Replace instance', () => {
        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'streetId',
                    label: 'Street',
                    fieldType: FieldType.Object,
                    objectType: 'Street'
                })}
                value={{ id: 42, name: 'King\'s Road' }}
                onChange={jest.fn()}
            />
        );

        expect(screen.getAllByRole('button', { name: /replace instance/i }).length).toBeGreaterThan(0);
    });
});
