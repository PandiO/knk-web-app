import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn(),
        getById: jest.fn()
    }
}));

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: '', displayName: '', fields: [] })
    }
}));

jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    }
}));

jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: {
        getByFormConfigurationId: jest.fn(),
        validateField: jest.fn(),
        resolvePlaceholders: jest.fn()
    }
}));

jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(() => async () => ({
        id: 14,
        Name: 'Northern Gate',
        GateDoors: []
    }))
}));

let mockNextCreatedDoorId = 201;

jest.mock('../ChildFormModal', () => ({
    ChildFormModal: ({
        open,
        parentEntityTypeName,
        parentEntitySnapshot,
        onComplete
    }: {
        open: boolean;
        parentEntityTypeName?: string;
        parentEntitySnapshot?: Record<string, unknown>;
        onComplete: (data: Record<string, unknown>) => void;
    }) =>
        open ? (
            <div>
                <div data-testid="child-modal-parent-type">{parentEntityTypeName ?? ''}</div>
                <div data-testid="child-modal-parent-snapshot">{JSON.stringify(parentEntitySnapshot ?? null)}</div>
                <button
                    type="button"
                    data-testid="complete-create-door"
                    onClick={() => onComplete({ id: mockNextCreatedDoorId++, name: 'New Door' })}
                >
                    complete create
                </button>
            </div>
        ) : null
}));

describe('FormWizard List+Object "Create New" child form integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);

        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue({
            id: '9',
            entityTypeName: 'GateStructure',
            configurationName: 'Gate Structure Configuration',
            description: '',
            isDefault: true,
            isActive: true,
            steps: [
                {
                    id: '16',
                    stepName: 'General Information',
                    description: '',
                    order: 0,
                    fieldOrderJson: '[]',
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    conditions: [],
                    fields: [
                        {
                            id: '44',
                            fieldName: 'Name',
                            label: 'Gate name',
                            fieldType: 'String',
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: [],
                            displayConditionGroups: []
                        },
                        {
                            id: '200',
                            fieldName: 'GateDoors',
                            label: 'Gate Doors',
                            fieldType: 'List',
                            elementType: 'Object',
                            objectType: 'GateDoor',
                            canCreate: true,
                            settingsJson: '{"ownedChildCollection":true}',
                            isRequired: false,
                            isReadOnly: false,
                            order: 1,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: [],
                            displayConditionGroups: []
                        }
                    ]
                }
            ]
        });
    });

    it('appends a newly created child to the list instead of replacing it, and prefills the child form with the parent snapshot', async () => {
        render(
            <FormWizard
                entityName="GateStructure"
                entityId="14"
                userId="1"
                onComplete={() => {}}
            />
        );

        // Edit mode - wait for the "Create New" button to become enabled, which only happens
        // once entityId is set (parentEntityIsSaved), confirming the wizard is past initial load.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /create new/i })).toBeEnabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /create new/i }));

        await waitFor(() => {
            expect(screen.getByTestId('complete-create-door')).toBeInTheDocument();
        });

        expect(screen.getByTestId('child-modal-parent-type').textContent).toBe('GateStructure');
        const snapshot = JSON.parse(screen.getByTestId('child-modal-parent-snapshot').textContent || 'null');
        expect(snapshot.id).toBe('14');

        fireEvent.click(screen.getByTestId('complete-create-door'));

        // Complete a second door - if the first append had replaced the field with a bare
        // object instead of an array, this second click would either throw or overwrite it.
        fireEvent.click(screen.getByRole('button', { name: /create new/i }));
        await waitFor(() => {
            expect(screen.getByTestId('complete-create-door')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId('complete-create-door'));

        await waitFor(() => {
            expect(screen.getAllByText('New Door')).toHaveLength(2);
        });
        expect(screen.getAllByRole('button', { name: /edit instance/i })).toHaveLength(2);
    });
});
