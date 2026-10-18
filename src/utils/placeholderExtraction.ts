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

const DISPLAY_NAME_KEYS = ['name', 'Name', 'displayName', 'DisplayName', 'title', 'Title'] as const;

function isPresent(value: unknown): boolean {
    return value !== null && value !== undefined && value !== '';
}

/**
 * KNG-173: the text a form value stands for in a placeholder. A relationship field holds the picked
 * record ({ id, name, ... }), which `String()` turned into "[object Object]" in a world task's
 * `allPlaceholders`: an object becomes its display name (name, displayName or title), else its id;
 * an array becomes its items' names joined by ", "; null and undefined become "".
 */
export const placeholderDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return '';
    }
    if (Array.isArray(value)) {
        return value
            .map(item => placeholderDisplayValue(item))
            .filter(text => text !== '')
            .join(', ');
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const nameKey = DISPLAY_NAME_KEYS.find(key => isPresent(record[key]) && typeof record[key] !== 'object');
        if (nameKey) {
            return String(record[nameKey]);
        }
        const id = record.id ?? record.Id;
        return isPresent(id) && typeof id !== 'object' ? String(id) : '';
    }
    return String(value);
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
                placeholders[field.fieldName] = placeholderDisplayValue(value);
            }
        });
    });

    return placeholders;
};
