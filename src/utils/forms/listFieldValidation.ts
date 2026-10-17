import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';

/**
 * KNG-164: step validation for List fields. `FormWizard.validateField` only treated null/undefined/''
 * as missing, so a required List passed with `[]`, and `minSelection`/`maxSelection` were only
 * enforced by `PagedEntityTable` refusing to deselect below its minimum (never for a list that was
 * empty from the start). "A Street needs at least one District" therefore wasn't enforced.
 *
 * - A required List needs at least one item; `minSelection` raises that minimum (also for an
 *   optional list, but then only once it has items: an optional empty list stays allowed).
 * - `maxSelection` caps the count.
 * - null/undefined/'' entries (an untouched "add item" row) don't count.
 * - Owned child collections (`ownedChildCollection`, e.g. GateStructure -> GateDoors) are skipped
 *   while the parent isn't saved yet: their items can only be added after the parent exists
 *   ("Save this record first"), so a minimum there would block creating the parent at all.
 *
 * Returns the message for the field, or null when the list is fine (or the field isn't a List).
 */
export function validateListFieldCount(
    field: FormFieldDto,
    value: unknown,
    options: { parentIsSaved: boolean }
): string | null {
    if (field.fieldType !== FieldType.List) {
        return null;
    }
    if (!options.parentIsSaved && isOwnedChildCollection(field.settingsJson)) {
        return null;
    }

    const count = countListItems(value);
    const min = positiveLimit(field.minSelection);
    const max = positiveLimit(field.maxSelection);

    if (field.isRequired && count === 0) {
        const needed = Math.max(min ?? 1, 1);
        return `${field.label} is required: select at least ${needed} ${itemWord(field, needed)}`;
    }
    if (min && count > 0 && count < min) {
        return `${field.label} needs at least ${min} ${itemWord(field, min)} (${count} selected)`;
    }
    if (max && count > max) {
        return `${field.label} allows at most ${max} ${itemWord(field, max)} (${count} selected)`;
    }
    return null;
}

export function countListItems(value: unknown): number {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (!Array.isArray(value)) {
        // A single object/value where a list is expected still counts as one item; submitting it is
        // refused elsewhere (normalizeFormSubmission, KNG-133).
        return 1;
    }
    return value.filter(item => item !== null && item !== undefined && item !== '').length;
}

const positiveLimit = (limit: number | null | undefined): number | null =>
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;

const itemWord = (field: FormFieldDto, count: number): string => {
    const noun = field.objectType || 'item';
    return count === 1 ? noun : `${noun}${/s$/i.test(noun) ? '' : 's'}`;
};

const isOwnedChildCollection = (settingsJson?: string | null): boolean => {
    if (!settingsJson) {
        return false;
    }
    try {
        return !!JSON.parse(settingsJson)?.ownedChildCollection;
    } catch {
        return false;
    }
};
