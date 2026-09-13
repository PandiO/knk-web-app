import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManyToManyRelationshipEditor } from '../ManyToManyRelationshipEditor';
import { FormStepDto } from '../../../types/dtos/forms/FormModels';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn()
    }
}));

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

jest.mock('../FieldRenderers', () => ({
    FieldRenderer: () => <div data-testid="field-renderer" />
}));

const baseStep: FormStepDto = {
    id: 'step-1',
    stepName: 'Default Enchantments',
    description: '',
    order: 0,
    fieldOrderJson: '[]',
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: true,
    relatedEntityPropertyName: 'DefaultEnchantments',
    joinEntityType: 'ItemBlueprintDefaultEnchantment',
    subConfigurationId: '6',
    childFormSteps: [],
    fields: [],
    conditions: []
};

describe('ManyToManyRelationshipEditor relationship drafts', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({
            entityName: 'ItemBlueprintDefaultEnchantment',
            displayName: 'Item Blueprint Default Enchantment',
            fields: [
                { fieldName: 'itemBlueprint', fieldType: 'ItemBlueprint', isNullable: false, isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', hasDefaultValue: false },
                { fieldName: 'enchantmentDefinition', fieldType: 'EnchantmentDefinition', isNullable: false, isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', hasDefaultValue: false },
                { fieldName: 'enchantmentDefinitionId', fieldType: 'Integer', isNullable: false, isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', hasDefaultValue: false }
            ]
        });

        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue({
            id: '6',
            entityTypeName: 'ItemBlueprintDefaultEnchantment',
            configurationName: 'Join config',
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: 'Join fields',
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    conditions: [],
                    fields: [
                        {
                            fieldName: 'ItemBlueprintId',
                            label: 'Item blueprint',
                            fieldType: 'Object',
                            objectType: 'ItemBlueprint',
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

    it('shows a draft join entry with its creator and resumes it via onOpenJoinEntry', async () => {
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([
            { id: '42', status: 'Paused', createdByUsername: 'the-creator', updatedAt: '2026-01-01T00:00:00Z' }
        ]);
        const onOpenJoinEntry = jest.fn();
        const onChange = jest.fn();

        render(
            <ManyToManyRelationshipEditor
                step={baseStep}
                value={[]}
                onChange={onChange}
                entityName="ItemBlueprint"
                entityId="9"
                userId="1"
                joinFormConfigurationId="6"
                onOpenJoinEntry={onOpenJoinEntry}
            />
        );

        await waitFor(() => {
            expect(formSubmissionClient.getByEntityTypeNameFiltered).toHaveBeenCalledWith(
                'ItemBlueprintDefaultEnchantment', 'ItemBlueprintId', '9'
            );
        });

        await waitFor(() => {
            expect(screen.getByTestId('relationship-draft-card')).toBeInTheDocument();
        });
        expect(screen.getByText(/started by the-creator/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /continue/i }));

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({ __pendingJoinEntry: true, __childProgressId: '42' })
        ]);
        await waitFor(() => {
            expect(onOpenJoinEntry).toHaveBeenCalledWith(0);
        });
    });

    it('does not fetch drafts when there is no linked join configuration', async () => {
        const stepWithoutJoinConfig: FormStepDto = { ...baseStep, subConfigurationId: undefined };

        render(
            <ManyToManyRelationshipEditor
                step={stepWithoutJoinConfig}
                value={[]}
                onChange={jest.fn()}
                entityName="ItemBlueprint"
                entityId="9"
                userId="1"
            />
        );

        await waitFor(() => {
            expect(metadataClient.getEntityMetadata).toHaveBeenCalled();
        });

        expect(formSubmissionClient.getByEntityTypeNameFiltered).not.toHaveBeenCalled();
        expect(screen.queryByTestId('relationship-draft-card')).not.toBeInTheDocument();
    });
});
