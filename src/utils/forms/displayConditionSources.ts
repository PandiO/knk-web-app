import { FormConfigurationDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { orderFormFields } from './formVisibility';

export interface SourceFieldOption {
    field: FormFieldDto;
    stepName: string;
    stepIndex: number;
    fieldIndex: number;
}

export const collectOrderedFields = (config: FormConfigurationDto): SourceFieldOption[] => {
    const result: SourceFieldOption[] = [];
    config.steps.forEach((step, stepIndex) => {
        orderFormFields(step).forEach((field, fieldIndex) => {
            result.push({ field, stepName: step.stepName, stepIndex, fieldIndex });
        });
    });
    return result;
};

/**
 * A step may only depend on fields the user has already filled in, so only earlier steps qualify.
 */
export const fieldsBeforeStep = (config: FormConfigurationDto, stepIndex: number): SourceFieldOption[] =>
    collectOrderedFields(config).filter(o => o.stepIndex < stepIndex);

/**
 * A field may depend on any field in an earlier step, or on an earlier field in its own step.
 */
export const fieldsBeforeField = (
    config: FormConfigurationDto,
    stepIndex: number,
    fieldGuid?: string
): SourceFieldOption[] => {
    const ordered = collectOrderedFields(config);
    const target = fieldGuid ? ordered.find(o => o.field.fieldGuid === fieldGuid) : undefined;

    if (!target) {
        // New field that is not part of the ordering yet: everything before its step, plus its step.
        return ordered.filter(o => o.stepIndex < stepIndex || o.stepIndex === stepIndex);
    }

    return ordered.filter(o =>
        o.stepIndex < target.stepIndex ||
        (o.stepIndex === target.stepIndex && o.fieldIndex < target.fieldIndex)
    );
};
