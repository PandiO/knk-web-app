import { FormFieldDto } from '../../types/dtos/forms/FormModels';

/**
 * KNG-134: what a completed Minecraft world task writes into the form.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function existingId(value: unknown): number | string | undefined {
    if (!isPlainObject(value)) {
        return undefined;
    }
    const id = value.id ?? value.Id;
    if (id === null || id === undefined || id === '' || id === 0 || id === -1) {
        return undefined;
    }
    return id as number | string;
}

/**
 * "Replace via Minecraft" on a Location the field already holds with an id: the captured value
 * keeps that id, so the parent's save updates the existing Location (the API's
 * `ResolveLocationReferenceAsync` updates a Location that has an id) instead of creating a second
 * one, and a later "Edit instance" still knows which Location it edits. Anything else is returned
 * unchanged.
 */
export function keepLocationIdOnReplace(previousValue: unknown, capturedValue: unknown): unknown {
    const id = existingId(previousValue);
    if (id === undefined || !isPlainObject(capturedValue) || existingId(capturedValue) !== undefined) {
        return capturedValue;
    }
    return { ...capturedValue, id };
}

/**
 * KNG-167: keys of a captured object that only fill a field still empty. A Minecraft capture
 * updates the coordinates and world (X, Y, Z, Yaw, Pitch, World); its `name` ("Location") is a
 * default, so it must never overwrite a Name the user typed.
 */
const FILL_ONLY_WHEN_EMPTY_KEYS = new Set(['name']);

function isEmptyFieldValue(value: unknown): boolean {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function findCaseInsensitive(values: Record<string, unknown> | undefined, fieldName: string): unknown {
    if (!values) {
        return undefined;
    }
    if (fieldName in values) {
        return values[fieldName];
    }
    const key = Object.keys(values).find(candidate => candidate.toLowerCase() === fieldName.toLowerCase());
    return key === undefined ? undefined : values[key];
}

/**
 * A child form opened from a world-task field inherits that field's task (`worldTaskHint`). When
 * the child's form has no field of the parent field's name, the task panel sits on the child's
 * first field, so a Location capture used to be written as one object into `Name` (spec §2.3,
 * confirmed in code 2026-10-12). Spread an object result over the child's fields instead: each key
 * goes to the field of the same name (case-insensitive), except that `name` only fills a Name field
 * that is still empty in `currentValues` (KNG-167). Returns null when the value isn't an object or
 * no key matches a field, so the caller can fall back to writing the bound field; returns an empty
 * patch when keys matched but all were kept (the bound field must not receive the object then).
 */
export function spreadTaskValueOntoFields(
    value: unknown,
    fields: Pick<FormFieldDto, 'fieldName'>[],
    currentValues?: Record<string, unknown>
): Record<string, unknown> | null {
    if (!isPlainObject(value)) {
        return null;
    }
    const keys = Object.keys(value);
    const patch: Record<string, unknown> = {};
    let matched = false;
    fields.forEach(field => {
        const key = keys.find(candidate => candidate.toLowerCase() === field.fieldName.toLowerCase());
        if (key === undefined) {
            return;
        }
        matched = true;
        if (FILL_ONLY_WHEN_EMPTY_KEYS.has(key.toLowerCase())
            && !isEmptyFieldValue(findCaseInsensitive(currentValues, field.fieldName))) {
            return;
        }
        patch[field.fieldName] = value[key];
    });
    return matched ? patch : null;
}
