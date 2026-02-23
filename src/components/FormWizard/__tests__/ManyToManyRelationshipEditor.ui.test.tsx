import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManyToManyRelationshipEditor } from '../ManyToManyRelationshipEditor';
import { FieldType } from '../../../utils/enums';
import { metadataClient } from '../../../apiClients/metadataClient';
import { getCreateFunctionForEntity } from '../../../utils/entityApiMapping';

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn()
    }
}));

jest.mock('../../../utils/entityApiMapping', () => ({
    getCreateFunctionForEntity: jest.fn()
}));

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: ({ refreshKey }: { refreshKey?: number }) => (
        <div>
            <div data-testid="paged-table">paged-table</div>
            <div data-testid="refresh-key">{String(refreshKey ?? 0)}</div>
        </div>
    )
}));

jest.mock('../ChildFormModal', () => ({
    ChildFormModal: ({ open, onComplete }: { open: boolean; onComplete: (data: Record<string, unknown>) => void }) => (
        open ? (
            <button
                type="button"
                data-testid="complete-create-related"
                onClick={() => onComplete({
                    displayName: 'Sharpness',
                    key: 'minecraft:sharpness',
                    maxLevel: 5
                })}
            >
                complete related form
            </button>
        ) : null
    )
}));

describe('ManyToManyRelationshipEditor UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates missing related entity, adds it as relationship, and refreshes selection table', async () => {
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({
            entityName: 'ItemBlueprintDefaultEnchantment',
            displayName: 'Item Blueprint Default Enchantment',
            fields: [
                { fieldName: 'ItemBlueprintId', isRelatedEntity: true, relatedEntityType: 'ItemBlueprint', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                { fieldName: 'EnchantmentDefinitionId', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Integer', isNullable: false, hasDefaultValue: false },
                { fieldName: 'EnchantmentDefinition', isRelatedEntity: true, relatedEntityType: 'EnchantmentDefinition', fieldType: 'Object', isNullable: true, hasDefaultValue: false }
            ]
        });

        const createEntity = jest.fn().mockResolvedValue({
            id: 321,
            displayName: 'Sharpness',
            key: 'minecraft:sharpness',
            maxLevel: 5
        });
        (getCreateFunctionForEntity as jest.Mock).mockReturnValue(createEntity);

        const onChange = jest.fn();

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
                    relatedEntityPropertyName: 'defaultEnchantments',
                    joinEntityType: 'ItemBlueprintDefaultEnchantment',
                    subConfigurationId: '6',
                    childFormSteps: [],
                    fields: [],
                    conditions: []
                }}
                value={[]}
                onChange={onChange}
                entityName="ItemBlueprint"
                userId="1"
                parentProgressId="progress-1"
                validationRules={{}}
                validationResults={{}}
                onValidateField={async () => {}}
            />
        );

        await waitFor(() => {
            expect(screen.queryByText('Create New EnchantmentDefinition')).not.toBeNull();
        });

        fireEvent.click(screen.getByText('Create New EnchantmentDefinition'));
        fireEvent.click(screen.getByTestId('complete-create-related'));

        await waitFor(() => {
            expect(createEntity).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    relatedEntityId: 321,
                    EnchantmentDefinitionId: 321,
                    relatedEntity: expect.objectContaining({
                        id: 321,
                        displayName: 'Sharpness'
                    })
                })
            ]);
        });

        await waitFor(() => {
            expect(screen.getByTestId('refresh-key').textContent).toBe('1');
        });
    });
});
