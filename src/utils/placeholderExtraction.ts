import { AllStepsData, FormConfigurationDto } from "../types/dtos/forms/FormModels";

/**
 * Extracts placeholder names (without braces) from a message template.
 */
export const extractPlaceholders = (messageTemplate: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(messageTemplate)) !== null) {
        matches.push(match[1]);
    }

    return matches;
};

/**
 * Builds Layer 0 placeholder values from the current form state.
 */
export const buildPlaceholderContext = (
    config: FormConfigurationDto,
    allStepsData: AllStepsData
): Record<string, string> => {
    const placeholders: Record<string, string> = {};

    config.steps.forEach((step, stepIndex) => {
        step.fields.forEach((field) => {
            const value = allStepsData[stepIndex]?.[field.fieldName];
            if (value !== null && value !== undefined) {
                placeholders[field.fieldName] = String(value);
            }
        });
    });

    return placeholders;
};
