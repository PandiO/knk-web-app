import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManyToManyRelationshipEditor } from '../ManyToManyRelationshipEditor';
import { FormStepDto } from '../../../types/dtos/forms/FormModels';
import { metadataClient } from '../../../apiClients/metadataClient';

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn()
    }
}));

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: ({ onSelectionChange }: { onSelectionChange: (items: Array<Record<string, unknown>>) => void }) => (
        <button
            type="button"
            data-testid="select-related"
            onClick={() => onSelectionChange([{ id: 7, name: 'Enchantment A' }])}
        >
            Select Related
        </button>
    )
}));

jest.mock('../FieldRenderers', () => ({
    FieldRenderer: ({ value, onChange }: { value: unknown; onChange: (newValue: unknown) => void }) => (
        <input
            data-testid="field-renderer"
            value={(value ?? '') as string}
            onChange={e => onChange(e.target.value)}
        />
    )
}));

const baseStep: FormStepDto = {
    id: 'step-1',
    stepName: 'Default Enchantments',
    title: 'Default Enchantments',
    description: '',
    order: 0,
    fieldOrderJson: '[]',
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: true,
    relatedEntityPropertyName: 'DefaultEnchantments',
    joinEntityType: 'ItemBlueprintDefaultEnchantment',
    childFormSteps: [],
    fields: [],
    conditions: []
};

const mockGetEntityMetadata = metadataClient.getEntityMetadata as jest.Mock;

describe('ManyToManyRelationshipEditor', () => {
    beforeEach(() => {
        mockGetEntityMetadata.mockReset();
    });

    it('maps selected related entity id to the join FK field', async () => {
        mockGetEntityMetadata.mockResolvedValue({
            entityName: 'ItemBlueprintDefaultEnchantment',
            displayName: 'Item Blueprint Default Enchantment',
            fields: [
                {
                    fieldName: 'itemBlueprint',
                    fieldType: 'ItemBlueprint',
                    isNullable: false,
                    isRelatedEntity: true,
                    relatedEntityType: 'ItemBlueprint',
                    hasDefaultValue: false,
                    defaultValue: null
                },
                {
                    fieldName: 'enchantmentDefinition',
                    fieldType: 'EnchantmentDefinition',
                    isNullable: false,
                    isRelatedEntity: true,
                    relatedEntityType: 'EnchantmentDefinition',
                    hasDefaultValue: false,
                    defaultValue: null
                },
                {
                    fieldName: 'enchantmentDefinitionId',
                    fieldType: 'int',
                    isNullable: false,
                    isRelatedEntity: false,
                    relatedEntityType: null,
                    hasDefaultValue: false,
                    defaultValue: null
                }
            ]
        });

        const handleChange = jest.fn();

        render(
            <ManyToManyRelationshipEditor
                step={baseStep}
                value={[]}
                onChange={handleChange}
                entityName="ItemBlueprint"
            />
        );

        const selectButton = await screen.findByTestId('select-related');
        fireEvent.click(selectButton);

        expect(handleChange).toHaveBeenCalledTimes(1);
        const updated = handleChange.mock.calls[0][0] as Array<Record<string, unknown>>;
        expect(updated[0].relatedEntityId).toBe(7);
        expect(updated[0].enchantmentDefinitionId).toBe(7);
    });

    it('shows a configuration warning when join FK metadata is missing', async () => {
        mockGetEntityMetadata.mockResolvedValue({
            entityName: 'ItemBlueprintDefaultEnchantment',
            displayName: 'Item Blueprint Default Enchantment',
            fields: [
                {
                    fieldName: 'itemBlueprint',
                    fieldType: 'ItemBlueprint',
                    isNullable: false,
                    isRelatedEntity: true,
                    relatedEntityType: 'ItemBlueprint',
                    hasDefaultValue: false,
                    defaultValue: null
                },
                {
                    fieldName: 'enchantmentDefinition',
                    fieldType: 'EnchantmentDefinition',
                    isNullable: false,
                    isRelatedEntity: true,
                    relatedEntityType: 'EnchantmentDefinition',
                    hasDefaultValue: false,
                    defaultValue: null
                }
            ]
        });

        render(
            <ManyToManyRelationshipEditor
                step={baseStep}
                value={[]}
                onChange={jest.fn()}
                entityName="ItemBlueprint"
            />
        );

        expect(
            await screen.findByText(
                'Unable to resolve the join entity foreign key field from metadata. Please verify the join entity model and metadata.'
            )
        ).toBeInTheDocument();
    });
});
