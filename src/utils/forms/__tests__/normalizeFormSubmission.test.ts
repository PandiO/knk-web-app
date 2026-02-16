import { normalizeFormSubmission } from '../normalizeFormSubmission';
import { FieldType } from '../../enums';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { EntityMetadataDto, FieldMetadataDto } from '../../../types/dtos/metadata/MetadataModels';

describe('normalizeFormSubmission (many-to-many join entries)', () => {
    const joinEntityMetadata: EntityMetadataDto = {
        entityName: 'ItemBlueprintDefaultEnchantment',
        displayName: 'Item Blueprint Default Enchantment',
        fields: [
            {
                fieldName: 'EnchantmentDefinition',
                fieldType: 'Object',
                isNullable: false,
                isRelatedEntity: true,
                relatedEntityType: 'EnchantmentDefinition',
                hasDefaultValue: false
            },
            {
                fieldName: 'EnchantmentDefinitionId',
                fieldType: 'Integer',
                isNullable: false,
                isRelatedEntity: false,
                relatedEntityType: null,
                hasDefaultValue: false
            } as FieldMetadataDto
        ]
    };

    const formField: FormFieldDto = {
        id: 'field-1',
        formStepId: 'step-1',
        fieldGuid: 'field-guid-1',
        fieldName: 'defaultEnchantments',
        label: 'Default Enchantments',
        fieldType: FieldType.List,
        isRequired: false,
        isReadOnly: false,
        order: 0,
        objectType: 'ItemBlueprintDefaultEnchantment',
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: []
    };

    const step: FormStepDto = {
        id: 'step-1',
        stepName: 'Step 1',
        title: 'Step 1',
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: true,
        relatedEntityPropertyName: 'defaultEnchantments',
        joinEntityType: 'ItemBlueprintDefaultEnchantment',
        childFormSteps: [],
        fields: [formField],
        conditions: []
    };

    const config: FormConfigurationDto = {
        id: 'config-1',
        entityTypeName: 'ItemBlueprint',
        configurationName: 'Item Blueprint',
        isDefault: true,
        isActive: true,
        steps: [step]
    };

    it('preserves join objects and maps related entity FK', () => {
        const rawFormValue = {
            defaultEnchantments: [
                {
                    relatedEntityId: 3,
                    level: 2,
                    relatedEntity: { id: 3, name: 'Sharpness' },
                    __childProgressId: 'progress-1'
                }
            ]
        };

        const normalized = normalizeFormSubmission({
            entityTypeName: 'ItemBlueprint',
            formConfiguration: config,
            rawFormValue,
            entityMetadata: [],
            joinEntityMetadataMap: {
                ItemBlueprintDefaultEnchantment: joinEntityMetadata
            }
        });

        expect(Array.isArray(normalized.defaultEnchantments)).toBe(true);
        expect(normalized.defaultEnchantments).toHaveLength(1);
        expect(normalized.defaultEnchantments[0]).toMatchObject({
            EnchantmentDefinitionId: 3,
            level: 2
        });
        expect(normalized.defaultEnchantments[0].relatedEntity).toBeUndefined();
        expect(normalized.defaultEnchantments[0].relatedEntityId).toBeUndefined();
        expect(normalized.defaultEnchantments[0].__childProgressId).toBeUndefined();
    });

    it('throws when join entity metadata is missing', () => {
        const rawFormValue = {
            defaultEnchantments: [{ relatedEntityId: 3, level: 2 }]
        };

        expect(() =>
            normalizeFormSubmission({
                entityTypeName: 'ItemBlueprint',
                formConfiguration: config,
                rawFormValue,
                entityMetadata: []
            })
        ).toThrow('Join entity metadata is missing');
    });

    it('throws when related entity id is missing', () => {
        const rawFormValue = {
            defaultEnchantments: [{ level: 2 }]
        };

        expect(() =>
            normalizeFormSubmission({
                entityTypeName: 'ItemBlueprint',
                formConfiguration: config,
                rawFormValue,
                entityMetadata: [],
                joinEntityMetadataMap: {
                    ItemBlueprintDefaultEnchantment: joinEntityMetadata
                }
            })
        ).toThrow('missing a related entity selection');
    });
});
