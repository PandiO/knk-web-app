/**
 * Interprets a Boolean-type field's current value. FormField.defaultValue is always a string
 * (e.g. "false"), so an untouched Boolean field's value is literally the string "false" until
 * the admin interacts with it - a naive `!!value` treats that (like any non-empty string) as
 * truthy. Used both for rendering (so an untouched "Activate immediately"-style checkbox starts
 * visibly unchecked, not misleadingly pre-checked) and for submission normalization, so the two
 * never disagree with each other.
 */
export function toBooleanFieldValue(value: unknown): boolean {
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'false') return false;
        if (lower === 'true') return true;
    }
    return !!value;
}
