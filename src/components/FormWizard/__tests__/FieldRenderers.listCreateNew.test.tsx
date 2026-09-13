import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: () => <div data-testid="paged-table">paged-table</div>
}));

const baseField = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
    fieldName: 'gateDoors',
    label: 'Gate Doors',
    fieldType: FieldType.List,
    elementType: FieldType.Object,
    objectType: 'GateDoor',
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
});

describe('FieldRenderer List+Object "Create New" and ownedChildCollection', () => {
    it('does not show Create New when no onCreateNew handler is provided', () => {
        render(
            <FieldRenderer
                field={baseField({})}
                value={[]}
                onChange={jest.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /create new/i })).not.toBeInTheDocument();
    });

    it('shows Create New and the existing-entity search table for a plain (non-owned) list', () => {
        render(
            <FieldRenderer
                field={baseField({})}
                value={[]}
                onChange={jest.fn()}
                onCreateNew={jest.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /create new/i })).toBeEnabled();
        expect(screen.getByTestId('paged-table')).toBeInTheDocument();
    });

    it('hides Create New when canCreate is false', () => {
        render(
            <FieldRenderer
                field={baseField({ canCreate: false })}
                value={[]}
                onChange={jest.fn()}
                onCreateNew={jest.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /create new/i })).not.toBeInTheDocument();
    });

    it('hides the existing-entity search table and remove button for an owned child collection', () => {
        render(
            <FieldRenderer
                field={baseField({ settingsJson: '{"ownedChildCollection":true}' })}
                value={[{ id: 1, name: 'Drawbridge' }]}
                onChange={jest.fn()}
                onCreateNew={jest.fn()}
                onEditInstance={jest.fn()}
                parentEntityIsSaved={true}
            />
        );

        expect(screen.queryByTestId('paged-table')).not.toBeInTheDocument();
        expect(screen.queryByTitle(/remove from selection/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create new/i })).toBeEnabled();
        expect(screen.getByRole('button', { name: /edit instance/i })).toBeInTheDocument();
        expect(screen.getByText('Drawbridge')).toBeInTheDocument();
    });

    it('disables Create New for an owned child collection until the parent entity is saved', () => {
        render(
            <FieldRenderer
                field={baseField({ settingsJson: '{"ownedChildCollection":true}' })}
                value={[]}
                onChange={jest.fn()}
                onCreateNew={jest.fn()}
                parentEntityIsSaved={false}
            />
        );

        expect(screen.getByRole('button', { name: /create new/i })).toBeDisabled();
    });
});
