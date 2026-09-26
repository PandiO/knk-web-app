/**
 * Context-dependent filters for an Object/List field's "Select instance" picker (siege Phase 3,
 * docs/specs/siege-minigame/PHASE_3_FORMCONFIGS.md).
 *
 * Authored on the FormField as settingsJson:
 *   { "pickerFilters": { "siegeScenarioId": "{parent.id}", "preferTownId": "{parent.TownId?}" },
 *     "pickerFiltersMissingMessage": "Save the scenario first." }
 *
 * Each value is either a literal string or one {token}:
 *   {parent.X}  - field X of the parent record this form was opened from (the owned-child modal or
 *                 the M2M join-entry modal passes the parent's current form values plus its "id";
 *                 -1 while the parent is unsaved)
 *   {X}         - field X of this form itself (e.g. the prefilled parent-link field)
 * Field names match case-insensitively. An Object value contributes its id. A trailing "?" makes
 * the filter optional: when it can't be resolved it's simply left out. A required token that can't
 * be resolved - missing, empty, or a non-positive number (the unsaved-parent placeholder) - makes
 * the picker unavailable instead: the paged search endpoints ignore a non-positive id filter and
 * would otherwise list every row.
 *
 * Filter values are always strings (the API's PagedQuery.Filters is a string dictionary).
 */

export interface PickerFilterSettings {
    pickerFilters: Record<string, string>;
    missingMessage?: string;
}

export interface ResolvedPickerFilters {
    filters: Record<string, string>;
    // Set when a required token couldn't be resolved; the picker should not query at all.
    unavailableReason?: string;
}

const TOKEN = /^\{(parent\.)?([A-Za-z0-9_]+)(\?)?\}$/;
const DEFAULT_MISSING_MESSAGE = 'Save the parent record first - this list depends on it.';

export const parsePickerFilterSettings = (settingsJson?: string): PickerFilterSettings | null => {
    if (!settingsJson) return null;
    try {
        const parsed = JSON.parse(settingsJson);
        const raw = parsed?.pickerFilters;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const pickerFilters: Record<string, string> = {};
        Object.entries(raw).forEach(([key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                pickerFilters[key] = String(value);
            }
        });
        if (Object.keys(pickerFilters).length === 0) return null;
        return {
            pickerFilters,
            missingMessage: typeof parsed.pickerFiltersMissingMessage === 'string'
                ? parsed.pickerFiltersMissingMessage
                : undefined
        };
    } catch {
        return null;
    }
};

const lookup = (source: Record<string, unknown> | undefined, name: string): unknown => {
    if (!source) return undefined;
    const key = Object.keys(source).find(k => k.toLowerCase() === name.toLowerCase());
    return key === undefined ? undefined : source[key];
};

/** A scalar filter value for a form value: an Object contributes its id; arrays don't resolve. */
const toFilterValue = (value: unknown): string | undefined => {
    if (value === null || value === undefined || Array.isArray(value)) return undefined;
    if (typeof value === 'object') {
        return toFilterValue(lookup(value as Record<string, unknown>, 'id'));
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? String(value) : undefined;
    }
    if (typeof value === 'boolean') return String(value);
    const text = String(value).trim();
    if (text === '') return undefined;
    // Numeric strings follow the number rule, so the "-1" unsaved-parent placeholder is missing too.
    const asNumber = Number(text);
    if (!Number.isNaN(asNumber) && asNumber <= 0) return undefined;
    return text;
};

export const resolvePickerFilters = (
    settings: PickerFilterSettings | null,
    ownValues: Record<string, unknown>,
    parentContext?: Record<string, unknown>
): ResolvedPickerFilters | null => {
    if (!settings) return null;

    const filters: Record<string, string> = {};
    let missing = false;

    Object.entries(settings.pickerFilters).forEach(([filterKey, template]) => {
        const match = TOKEN.exec(template.trim());
        if (!match) {
            filters[filterKey] = template;
            return;
        }

        const [, parentPrefix, name, optionalMark] = match;
        const source = parentPrefix ? parentContext : ownValues;
        const resolved = toFilterValue(lookup(source, name));

        if (resolved !== undefined) {
            filters[filterKey] = resolved;
        } else if (!optionalMark) {
            missing = true;
        }
    });

    return missing
        ? { filters, unavailableReason: settings.missingMessage || DEFAULT_MISSING_MESSAGE }
        : { filters };
};
