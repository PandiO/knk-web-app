import { FieldValidationDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { ValidationType } from '../enums';

/**
 * #109 (CRUD-8): the client-side checks of a field's own validations (FormField.validations), run on
 * blur and before Next/Save. Required is checked by the wizard itself; Custom only runs on the API.
 * Parameters (parametersJson): MinLength `{ "min": n }` (or `minLength`), MaxLength `{ "max": n }`
 * (or `maxLength`), Range `{ "min": a, "max": b }`, Regex `{ "pattern": "..." }`. An empty value is
 * left to Required, a validation with `isActive: false` is skipped, and a broken parameter is ignored
 * rather than blocking the form. Returns the first failure's message, or null.
 */
export function checkFieldValidations(field: Pick<FormFieldDto, 'label' | 'validations'>, value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    for (const validation of field.validations ?? []) {
        if (validation.isActive === false) continue;
        const failure = checkOne(validation, field.label, value);
        if (failure) return failure;
    }
    return null;
}

function parameters(validation: FieldValidationDto): Record<string, unknown> {
    if (!validation.parametersJson) return {};
    try {
        const parsed = JSON.parse(validation.parametersJson);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function numberParam(params: Record<string, unknown>, ...keys: string[]): number | undefined {
    for (const key of keys) {
        const raw = params[key];
        const parsed = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
        if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkOne(validation: FieldValidationDto, label: string, value: unknown): string | null {
    const params = parameters(validation);
    const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;
    const message = (fallback: string) => validation.errorMessage?.trim() || fallback;

    switch (validation.validationType) {
        case ValidationType.MinLength: {
            const min = numberParam(params, 'min', 'minLength');
            if (text === null || min === undefined) return null;
            return text.length < min ? message(`${label} needs at least ${min} characters`) : null;
        }
        case ValidationType.MaxLength: {
            const max = numberParam(params, 'max', 'maxLength');
            if (text === null || max === undefined) return null;
            return text.length > max ? message(`${label} can have at most ${max} characters`) : null;
        }
        case ValidationType.Range: {
            const numeric = typeof value === 'number' ? value : text !== null && text.trim() !== '' ? Number(text) : NaN;
            if (!Number.isFinite(numeric)) return null;
            const min = numberParam(params, 'min');
            const max = numberParam(params, 'max');
            if (min !== undefined && numeric < min) return message(`${label} must be at least ${min}`);
            if (max !== undefined && numeric > max) return message(`${label} must be at most ${max}`);
            return null;
        }
        case ValidationType.Regex: {
            const pattern = typeof params.pattern === 'string' ? params.pattern : undefined;
            if (text === null || !pattern) return null;
            let regex: RegExp;
            try {
                regex = new RegExp(pattern);
            } catch {
                return null;
            }
            return regex.test(text) ? null : message(`${label} has the wrong format`);
        }
        case ValidationType.Email:
            if (text === null) return null;
            return EMAIL.test(text.trim()) ? null : message(`${label} must be an email address`);
        default:
            return null;
    }
}
