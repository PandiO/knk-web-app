import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChildFormModal } from '../ChildFormModal';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { workflowClient } from '../../../apiClients/workflowClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn(),
        getById: jest.fn()
    }
}));

jest.mock('../../../apiClients/workflowClient', () => ({
    workflowClient: {
        createSession: jest.fn()
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

describe('ChildFormModal creates its own workflow session for world-task fields', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);

        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue({
            id: '12',
            entityTypeName: 'GateDoor',
            configurationName: 'Gate Door Configuration',
            description: '',
            isDefault: true,
            isActive: true,
            steps: [
                {
                    id: '32',
                    stepName: 'Geometry: Plane Grid',
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
                            id: '132',
                            fieldName: 'AnchorPointId',
                            label: 'Anchor point',
                            fieldType: 'Object',
                            objectType: 'Location',
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: [],
                            settingsJson: '{"worldTask":{"enabled":true,"taskType":"LocationSelection"}}',
                            displayConditionGroups: []
                        }
                    ]
                }
            ]
        });

        (workflowClient.createSession as jest.Mock).mockResolvedValue({ id: 555 });
    });

    it('creates its own workflow session (no worldTaskHint supplied) and renders the Send to Minecraft action', async () => {
        render(
            <ChildFormModal
                open={true}
                entityTypeName="GateDoor"
                userId="1"
                fieldName="GateDoors"
                currentStepIndex={0}
                onComplete={jest.fn()}
                onClose={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(workflowClient.createSession).toHaveBeenCalledWith(
                expect.objectContaining({ entityTypeName: 'GateDoor', formConfigurationId: 12 })
            );
        });

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /send to minecraft/i }).length).toBeGreaterThan(0);
        });
    });

    it('does not create a new session when one is already supplied (existing worldTaskHint path)', async () => {
        render(
            <ChildFormModal
                open={true}
                entityTypeName="GateDoor"
                userId="1"
                fieldName="GateDoors"
                currentStepIndex={0}
                workflowSessionId={999}
                worldTaskHint="LocationSelection"
                onComplete={jest.fn()}
                onClose={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /send to minecraft/i }).length).toBeGreaterThan(0);
        });

        expect(workflowClient.createSession).not.toHaveBeenCalled();
    });
});
