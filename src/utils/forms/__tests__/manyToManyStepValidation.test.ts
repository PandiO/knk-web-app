import { getManyToManyStepIssues } from '../manyToManyStepValidation';
import { FormStepDto } from '../../../types/dtos/forms/FormModels';

const baseStep: FormStepDto = {
    id: 'step-1',
    stepName: 'Step 1',
    title: 'Step 1',
    description: '',
    order: 0,
    fieldOrderJson: '[]',
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: true,
    relatedEntityPropertyName: 'DefaultEnchantments',
    joinEntityType: undefined,
    subConfigurationId: undefined,
    childFormSteps: [],
    fields: [],
    conditions: []
};

describe('getManyToManyStepIssues', () => {
    it('returns issue when join entity type is missing', () => {
        const issues = getManyToManyStepIssues({ ...baseStep, joinEntityType: undefined });
        expect(issues.map(i => i.code)).toContain('missing-join-entity-type');
    });

    it('returns issue when no join field source is defined', () => {
        const issues = getManyToManyStepIssues({
            ...baseStep,
            joinEntityType: 'ItemBlueprintDefaultEnchantment',
            childFormSteps: [],
            subConfigurationId: undefined
        });
        expect(issues.map(i => i.code)).toContain('missing-join-fields');
    });

    it('does not return join-field issue when linked configuration is set', () => {
        const issues = getManyToManyStepIssues({
            ...baseStep,
            joinEntityType: 'ItemBlueprintDefaultEnchantment',
            subConfigurationId: '42'
        });
        expect(issues.map(i => i.code)).not.toContain('missing-join-fields');
    });

    it('returns no issues for non-many-to-many steps', () => {
        const issues = getManyToManyStepIssues({
            ...baseStep,
            isManyToManyRelationship: false
        });
        expect(issues).toHaveLength(0);
    });
});
