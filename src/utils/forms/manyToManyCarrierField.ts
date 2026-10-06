import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';

/**
 * A many-to-many step's relationships live in the step data under relatedEntityPropertyName (the
 * key FormWizard reads and writes for ManyToManyRelationshipEditor). FormWizard keeps, flattens and
 * submits step data per declared field, so authored configs give such a step a List field of that
 * name (the PHASE_*_FORMCONFIGS.md payloads under knk-workspace docs/specs/). The builder doesn't require one, and
 * without it every relationship change was silently dropped - so a step lacking it gets one here.
 */
const carrierFieldName = (step: FormStepDto): string => step.relatedEntityPropertyName || 'relationships';

const needsCarrierField = (step: FormStepDto): boolean => {
    if (!step.isManyToManyRelationship) return false;
    const name = carrierFieldName(step).toLowerCase();
    return !step.fields.some(field => field.fieldName.toLowerCase() === name);
};

/** The configuration with a carrier List field added to each many-to-many step that lacks one; the input is returned as is when none does. */
export const withManyToManyCarrierFields = (config: FormConfigurationDto): FormConfigurationDto => {
    if (!config.steps.some(needsCarrierField)) return config;

    return {
        ...config,
        steps: config.steps.map(step => {
            if (!needsCarrierField(step)) return step;

            const carrier: FormFieldDto = {
                fieldName: carrierFieldName(step),
                label: step.stepName,
                fieldType: FieldType.List,
                objectType: step.joinEntityType,
                isRequired: false,
                isReadOnly: false,
                order: step.fields.reduce((max, field) => Math.max(max, field.order + 1), 0),
                isReusable: false,
                isLinkedToSource: false,
                hasCompatibilityIssues: false,
                validations: []
            };
            return { ...step, fields: [...step.fields, carrier] };
        })
    };
};
