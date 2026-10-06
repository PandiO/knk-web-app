import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManyToManyRelationshipEditor } from '../ManyToManyRelationshipEditor';
import { metadataClient } from '../../../apiClients/metadataClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { FieldType } from '../../../utils/enums';

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn()
    }
}));

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn().mockResolvedValue(null)
    }
}));

jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getByEntityTypeNameFiltered: jest.fn()
    }
}));

jest.mock('../FieldRenderers', () => ({
    FieldRenderer: () => <div data-testid="field-renderer" />
}));

/**
 * "Create New Join Entry" is the M2M editor's add flow since c3b77a6 replaced the related-entity
 * picker table: it appends a pending relationship row and then opens the join-entry form for it
 * (FormWizard.handleOpenJoinEntry), which picks the related entity and fills the join fields.
 */
describe('ManyToManyRelationshipEditor UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
    });

    it('appends a pending join entry with child-step defaults and opens the join-entry form for it', async () => {
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({
            entityName: 'ItemBlueprintDefaultEnchantment',
            displayName: 'Item Blueprint Default Enchantment',
            fields: [
                { fieldName: 'ItemBlueprintId', isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                { fieldName: 'EnchantmentDefinitionId', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                { fieldName: 'EnchantmentDefinition', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Object', isNullable: true, hasDefaultValue: false }
            ]
        });

        const existing = { relatedEntityId: 7, EnchantmentDefinitionId: 7, relatedEntity: { id: 7, displayName: 'Unbreaking' }, __dndKey: 'k1' };
        const onChange = jest.fn();
        const onOpenJoinEntry = jest.fn();

        render(
            <ManyToManyRelationshipEditor
                step={{
                    id: '11',
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
                    childFormSteps: [
                        {
                            id: '12',
                            stepName: 'Join fields',
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            isManyToManyRelationship: false,
                            childFormSteps: [],
                            conditions: [],
                            fields: [
                                { id: '13', fieldName: 'Level', label: 'Level', fieldType: FieldType.Integer, defaultValue: '1', isRequired: true, isReadOnly: false, order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [] }
                            ]
                        }
                    ],
                    fields: [],
                    conditions: []
                }}
                value={[existing]}
                onChange={onChange}
                entityName="ItemBlueprint"
                userId="1"
                parentProgressId="progress-1"
                onOpenJoinEntry={onOpenJoinEntry}
                validationRules={{}}
                validationResults={{}}
                onValidateField={async () => {}}
            />
        );

        // Enabled once join metadata has resolved the related entity type.
        const createButton = await screen.findByRole('button', { name: 'Create New Join Entry' });
        await waitFor(() => expect(createButton).toBeEnabled());

        fireEvent.click(createButton);

        expect(onChange).toHaveBeenCalledWith([
            existing,
            expect.objectContaining({ __pendingJoinEntry: true, Level: '1' })
        ]);
        await waitFor(() => expect(onOpenJoinEntry).toHaveBeenCalledWith(1));
    });
});
