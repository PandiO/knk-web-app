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

    it('renders location details restored from saved form progress without an empty ID', () => {
        const restoredValue = JSON.parse(JSON.stringify({
            name: 'Location',
            x: 1422.7,
            y: 85,
            z: -521.59,
            yaw: -171.78,
            pitch: 89.85,
            World: 'world_KNK-DEV'
        }));

        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'anchorPointId',
                    label: 'Anchor point',
                    fieldType: FieldType.Object,
                    objectType: 'Location'
                })}
                value={restoredValue}
                onChange={jest.fn()}
            />
        );

        expect(screen.getByText('(1422.70, 85.00, -521.59)')).toBeVisible();
        expect(screen.getByText('yaw=-171.78, pitch=89.85')).toBeVisible();
        expect(screen.getByText('world_KNK-DEV')).toBeVisible();
        expect(screen.queryByText(/^ID:/)).not.toBeInTheDocument();
    });

    it('does not expose mutating object actions for a read-only field', () => {
        const onChange = jest.fn();

        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'regionClosedId',
                    label: 'Closed Region Id',
                    fieldType: FieldType.Object,
                    objectType: 'Location',
                    isReadOnly: true
                })}
                value={{ id: 42, name: 'gate_closed' }}
                onChange={onChange}
                onCreateNew={jest.fn()}
                onEditInstance={jest.fn()}
                onWorldTaskAction={jest.fn()}
            />
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('hides Add Item when a collection is populated by a WorldTask', () => {
        render(
            <FieldRenderer
                field={baseField({
                    fieldName: 'gateAnimationScan',
                    label: 'Gate Animation scan',
                    fieldType: FieldType.List,
                    elementType: FieldType.String
                })}
                value={[]}
                onChange={jest.fn()}
                hideCollectionAddItem
            />
        );

        expect(screen.queryByRole('button', { name: /add item/i })).not.toBeInTheDocument();
    });
});
