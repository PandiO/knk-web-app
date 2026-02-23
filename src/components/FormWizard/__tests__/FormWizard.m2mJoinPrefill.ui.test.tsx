import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { FormSubmissionStatus } from '../../../utils/enums';

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn(),
        getById: jest.fn()
    }
}));

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn()
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

jest.mock('../ManyToManyRelationshipEditor', () => ({
    ManyToManyRelationshipEditor: ({ onChange, onOpenJoinEntry }: { onChange: (value: Record<string, unknown>[]) => void; onOpenJoinEntry?: (relationshipIndex: number) => void }) => (
        <div>
            <button
                type="button"
                data-testid="seed-relationship"
                onClick={() => onChange([
                    {
                        relatedEntityId: 99,
                        relatedEntity: {
                            id: 99,
                            displayName: 'Sharpness',
                            key: 'minecraft:sharpness'
                        }
                    }
                ])}
            >
                seed relationship
            </button>
            <button
                type="button"
                data-testid="open-join-entry"
                onClick={() => onOpenJoinEntry?.(0)}
            >
                open join entry
            </button>
        </div>
    )
}));

jest.mock('../JoinEntityFormModal', () => ({
    JoinEntityFormModal: ({ open, initialFieldValues }: { open: boolean; initialFieldValues?: Record<string, unknown> }) => (
        <div data-testid="join-modal">
            <div data-testid="join-modal-open">{open ? 'open' : 'closed'}</div>
            <div data-testid="join-modal-initial-values">{JSON.stringify(initialFieldValues ?? {})}</div>
        </div>
    )
}));

describe('FormWizard M2M join-entry prefill UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockResolvedValue({
            id: 'progress-1',
            formConfigurationId: '5',
            currentStepIndex: 0,
            status: FormSubmissionStatus.InProgress
        });
    });

    it('prefills join modal with related entity id and unsaved parent placeholder id', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue({
            id: '5',
            entityTypeName: 'ItemBlueprint',
            configurationName: 'ItemBlueprint Default',
            description: '',
            isDefault: true,
            isActive: true,
            steps: [
                {
                    id: '11',
                    stepName: 'Default Enchantments',
                    description: '',
                    order: 0,
                    fieldOrderJson: '[]',
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: true,
                    relatedEntityPropertyName: 'defaultEnchantments',
                    joinEntityType: 'ItemBlueprintDefaultEnchantment',
                    subConfigurationId: '6',
                    childFormSteps: [],
                    fields: [],
                    conditions: []
                }
            ]
        });

        (metadataClient.getEntityMetadata as jest.Mock).mockImplementation(async (entityName: string) => {
            if (entityName === 'ItemBlueprintDefaultEnchantment') {
                return {
                    entityName: 'ItemBlueprintDefaultEnchantment',
                    displayName: 'ItemBlueprintDefaultEnchantment',
                    fields: [
                        { fieldName: 'ItemBlueprintId', isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                        { fieldName: 'ItemBlueprint', isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', fieldType: 'Object', isNullable: true, hasDefaultValue: false },
                        { fieldName: 'EnchantmentDefinitionId', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                        { fieldName: 'EnchantmentDefinition', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Object', isNullable: true, hasDefaultValue: false }
                    ]
                };
            }

            return {
                entityName: 'ItemBlueprint',
                displayName: 'ItemBlueprint',
                fields: []
            };
        });

        render(
            <FormWizard
                entityName="ItemBlueprint"
                userId="1"
                onComplete={() => {}}
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId('seed-relationship')).not.toBeNull();
        });

        fireEvent.click(screen.getByTestId('seed-relationship'));
        fireEvent.click(screen.getByTestId('open-join-entry'));

        await waitFor(() => {
            expect((formSubmissionClient.create as jest.Mock).mock.calls.length).toBeGreaterThan(0);
        });

        await waitFor(() => {
            expect(screen.getByTestId('join-modal-open').textContent).toBe('open');
        });

        const initialValuesText = screen.getByTestId('join-modal-initial-values').textContent || '';
        const parsed = JSON.parse(initialValuesText);

        expect(parsed.ItemBlueprintId).toBe(-1);
        expect(parsed.EnchantmentDefinitionId).toBe(99);
    });
});
