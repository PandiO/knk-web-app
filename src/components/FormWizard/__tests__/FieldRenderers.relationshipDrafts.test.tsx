import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldRenderer } from '../FieldRenderers';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn()
    }
}));

jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getByEntityTypeNameFiltered: jest.fn()
    }
}));

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
    settingsJson: '{"ownedChildCollection":true}',
    ...overrides
});

describe('FieldRenderer relationship drafts on an owned child collection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue({
            id: '12',
            entityTypeName: 'GateDoor',
            configurationName: 'Gate Door Configuration',
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: 'General Information',
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    conditions: [],
                    fields: [
                        {
                            fieldName: 'GateStructureId',
                            label: 'Gate structure',
                            fieldType: FieldType.Object,
                            objectType: 'GateStructure',
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ]
                }
            ]
        });
    });

    it('shows a draft card with its creator and a working Continue action', async () => {
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([
            { id: '77', status: 'Paused', createdByUsername: 'the-creator', updatedAt: '2026-01-01T00:00:00Z' }
        ]);
        const onContinueDraft = jest.fn();

        render(
            <FieldRenderer
                field={baseField({})}
                value={[]}
                onChange={jest.fn()}
                parentEntityTypeName="GateStructure"
                parentEntityId="14"
                onContinueDraft={onContinueDraft}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('relationship-draft-card')).toBeInTheDocument();
        });

        expect(screen.getByText(/started by the-creator/i)).toBeInTheDocument();
        expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        expect(onContinueDraft).toHaveBeenCalledWith(
            expect.objectContaining({ progressId: '77', createdByUsername: 'the-creator' })
        );
    });

    it('does not fetch drafts for a non-owned-child-collection list field', async () => {
        render(
            <FieldRenderer
                field={baseField({ settingsJson: undefined })}
                value={[]}
                onChange={jest.fn()}
                parentEntityTypeName="GateStructure"
                parentEntityId="14"
            />
        );

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(formConfigClient.getByEntityTypeName).not.toHaveBeenCalled();
        expect(screen.queryByTestId('relationship-draft-card')).not.toBeInTheDocument();
    });

    it('shows no drafts section when there are none', async () => {
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);

        render(
            <FieldRenderer
                field={baseField({})}
                value={[]}
                onChange={jest.fn()}
                parentEntityTypeName="GateStructure"
                parentEntityId="14"
            />
        );

        await waitFor(() => {
            expect(formSubmissionClient.getByEntityTypeNameFiltered).toHaveBeenCalled();
        });

        expect(screen.queryByTestId('relationship-draft-card')).not.toBeInTheDocument();
    });
});
