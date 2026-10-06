import { withManyToManyCarrierFields } from '../manyToManyCarrierField';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';

const step = (overrides: Partial<FormStepDto>): FormStepDto => ({
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
    childFormSteps: [],
    fields: [],
    conditions: [],
    ...overrides
});

const config = (steps: FormStepDto[]): FormConfigurationDto => ({
    id: '5',
    entityTypeName: 'ItemBlueprint',
    configurationName: 'ItemBlueprint Default',
    description: '',
    isDefault: true,
    isActive: true,
    steps
});

const carrier = (fieldName: string): FormFieldDto => ({
    fieldName,
    label: fieldName,
    fieldType: FieldType.List,
    objectType: 'ItemBlueprintDefaultEnchantment',
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
});

describe('withManyToManyCarrierFields', () => {
    it('adds a List field named after relatedEntityPropertyName to a fieldless many-to-many step', () => {
        const result = withManyToManyCarrierFields(config([step({})]));

        expect(result.steps[0].fields).toEqual([
            expect.objectContaining({
                fieldName: 'DefaultEnchantments',
                fieldType: FieldType.List,
                objectType: 'ItemBlueprintDefaultEnchantment',
                isRequired: false
            })
        ]);
    });

    it('falls back to "relationships", the key FormWizard uses when relatedEntityPropertyName is unset', () => {
        const result = withManyToManyCarrierFields(config([step({ relatedEntityPropertyName: undefined })]));

        expect(result.steps[0].fields.map(f => f.fieldName)).toEqual(['relationships']);
    });

    it('leaves an authored carrier field alone, matching its name case-insensitively', () => {
        const authored = carrier('defaultEnchantments');
        const input = config([step({ fields: [authored] })]);

        const result = withManyToManyCarrierFields(input);

        expect(result).toBe(input);
        expect(result.steps[0].fields).toEqual([authored]);
    });

    it('ignores steps that are not many-to-many', () => {
        const input = config([step({ isManyToManyRelationship: false, relatedEntityPropertyName: undefined })]);

        expect(withManyToManyCarrierFields(input)).toBe(input);
    });

    it('does not mutate the fetched configuration', () => {
        const input = config([step({})]);

        withManyToManyCarrierFields(input);

        expect(input.steps[0].fields).toEqual([]);
    });
});
