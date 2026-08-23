import { AllStepsData, FormConfigurationDto, FormFieldDto, FormStepDto, StepData } from '../../types/dtos/forms/FormModels';
import { DisplayConditionEvaluator } from '../conditionEvaluator';

export interface FormVisibility {
    /** Indices into `config.steps` that the user should be able to reach, in form order. */
    visibleStepIndices: number[];
    /** Field names that are visible, per step index. */
    visibleFieldNames: Record<number, Set<string>>;
    /** Flat map of every visible field value, keyed by field name. */
    visibleValues: Record<string, unknown>;
}

export interface ReconcileResult {
    /** Only the data of steps/fields that are currently visible. */
    allStepsData: AllStepsData;
    /**
     * Values that belong to a hidden step or field. Kept so the user gets their input back when
     * a branch becomes relevant again, but never part of the submission payload.
     */
    hiddenStash: AllStepsData;
    visibility: FormVisibility;
}

export const orderFormFields = (step?: FormStepDto): FormFieldDto[] => {
    if (!step) return [];
    if (!step.fieldOrderJson) {
        return [...step.fields].sort((a, b) => a.order - b.order);
    }

    try {
        const orderArray = JSON.parse(step.fieldOrderJson);
        if (!Array.isArray(orderArray) || orderArray.length === 0) {
            return [...step.fields].sort((a, b) => a.order - b.order);
        }

        const fieldMap = new Map<string, FormFieldDto>();
        step.fields.forEach(f => {
            if (f.fieldGuid) fieldMap.set(f.fieldGuid, f);
        });

        const reordered: FormFieldDto[] = [];
        orderArray.forEach((guid: string) => {
            const field = fieldMap.get(guid);
            if (field) reordered.push(field);
        });

        step.fields.forEach(f => {
            if (!reordered.includes(f)) reordered.push(f);
        });

        return reordered;
    } catch {
        return [...step.fields].sort((a, b) => a.order - b.order);
    }
};

export const buildFieldNameByGuid = (config: FormConfigurationDto): Record<string, string> => {
    const map: Record<string, string> = {};
    config.steps.forEach(step => {
        step.fields.forEach(field => {
            if (field.fieldGuid) map[field.fieldGuid] = field.fieldName;
        });
    });
    return map;
};

/**
 * Single forward pass over the form. Because a display condition may only reference a field that
 * comes earlier in the form (enforced by the API), every source value is already resolved by the
 * time its target is evaluated, so no iteration to a fixpoint is needed.
 */
export const reconcileVisibility = (
    config: FormConfigurationDto,
    allStepsData: AllStepsData,
    hiddenStash: AllStepsData
): ReconcileResult => {
    const fieldNameByGuid = buildFieldNameByGuid(config);

    const nextAllStepsData: AllStepsData = {};
    const nextStash: AllStepsData = {};
    const visibleValues: Record<string, unknown> = {};
    const visibleStepIndices: number[] = [];
    const visibleFieldNames: Record<number, Set<string>> = {};

    config.steps.forEach((step, stepIndex) => {
        const candidate: StepData = {
            ...(hiddenStash[stepIndex] || {}),
            ...(allStepsData[stepIndex] || {})
        };

        const stepVisible = DisplayConditionEvaluator.isVisible(
            step.displayConditionGroups,
            visibleValues,
            fieldNameByGuid
        );

        if (stepVisible) visibleStepIndices.push(stepIndex);
        visibleFieldNames[stepIndex] = new Set<string>();

        orderFormFields(step).forEach(field => {
            const fieldVisible = stepVisible && DisplayConditionEvaluator.isVisible(
                field.displayConditionGroups,
                visibleValues,
                fieldNameByGuid
            );

            const hasValue = Object.prototype.hasOwnProperty.call(candidate, field.fieldName);
            const value = candidate[field.fieldName];

            if (fieldVisible) {
                visibleFieldNames[stepIndex].add(field.fieldName);
                if (hasValue) {
                    nextAllStepsData[stepIndex] = { ...(nextAllStepsData[stepIndex] || {}), [field.fieldName]: value };
                }
                visibleValues[field.fieldName] = hasValue ? value : undefined;
            } else if (hasValue) {
                nextStash[stepIndex] = { ...(nextStash[stepIndex] || {}), [field.fieldName]: value };
            }
        });

        // Preserve values that do not map to a field of this step (join entries, bookkeeping).
        Object.keys(candidate).forEach(key => {
            const isKnownField = step.fields.some(f => f.fieldName === key);
            if (isKnownField) return;
            if (stepVisible) {
                nextAllStepsData[stepIndex] = { ...(nextAllStepsData[stepIndex] || {}), [key]: candidate[key] };
            } else {
                nextStash[stepIndex] = { ...(nextStash[stepIndex] || {}), [key]: candidate[key] };
            }
        });
    });

    return {
        allStepsData: nextAllStepsData,
        hiddenStash: nextStash,
        visibility: { visibleStepIndices, visibleFieldNames, visibleValues }
    };
};

export const nextVisibleStepIndex = (visibility: FormVisibility, from: number): number | null => {
    const next = visibility.visibleStepIndices.find(i => i > from);
    return next === undefined ? null : next;
};

export const previousVisibleStepIndex = (visibility: FormVisibility, from: number): number | null => {
    const previous = [...visibility.visibleStepIndices].reverse().find(i => i < from);
    return previous === undefined ? null : previous;
};

/** Nearest reachable step when the current one just became hidden. */
export const nearestVisibleStepIndex = (visibility: FormVisibility, from: number): number => {
    if (visibility.visibleStepIndices.includes(from)) return from;
    return previousVisibleStepIndex(visibility, from)
        ?? nextVisibleStepIndex(visibility, from)
        ?? 0;
};
