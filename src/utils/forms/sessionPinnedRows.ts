/**
 * KNG-136: which form-session entities a picker pins, and the stable row keys PagedEntityTable uses
 * (knk-workspace docs/specs/form-configurations/FORM_WIZARD_SESSION_CONCEPTS.md §3.3).
 *
 * No search endpoint can filter by a list of ids today, so pinned rows are filtered here, on the
 * client, with the same search term and pickerFilters the table sends to the server:
 *  - search term: case-insensitive substring of the row's label fields (name, displayName, ...)
 *    or its exact id;
 *  - a filter `xId` / `x` compares with the row's `xId`, `x` or `x.id` (case-insensitive names);
 *  - `excludeIds` (comma-separated) drops those ids; filters named `prefer...` only order results
 *    on the server and are ignored here;
 *  - any other filter the row can't answer hides the pinned row (the server might have excluded it).
 * A pinned row the current page also holds is always shown (the server accepted it), once, pinned.
 */

export interface PinnedRow<T = Record<string, unknown>> {
    /** Stable key of the session entry, e.g. "district:12". */
    key: string;
    row: T;
    /** Badge text; "New" when omitted. */
    badge?: string;
}

const LABEL_FIELDS = ['name', 'displayName', 'title', 'label', 'key', 'resolvedName'];

const lookup = (row: Record<string, unknown>, name: string): { found: boolean; value: unknown } => {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
        return { found: true, value: row[name] };
    }
    const lower = name.toLowerCase();
    const key = Object.keys(row).find(k => k.toLowerCase() === lower);
    return key === undefined ? { found: false, value: undefined } : { found: true, value: row[key] };
};

const idOf = (value: unknown): unknown => {
    if (value !== null && typeof value === 'object') {
        return lookup(value as Record<string, unknown>, 'id').value;
    }
    return value;
};

const present = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

export function matchesSearchTerm(row: Record<string, unknown>, searchTerm?: string): boolean {
    const term = (searchTerm ?? '').trim().toLowerCase();
    if (!term) return true;
    const id = idOf(row);
    if (present(id) && String(id).toLowerCase() === term) return true;
    return LABEL_FIELDS.some(field => {
        const { value } = lookup(row, field);
        return (typeof value === 'string' || typeof value === 'number') && String(value).toLowerCase().includes(term);
    });
}

/** The value a row holds for a filter key, or `found: false` if the row has no such property. */
function rowFilterValue(row: Record<string, unknown>, filterKey: string): { found: boolean; value: unknown } {
    const direct = lookup(row, filterKey);
    if (direct.found) return { found: true, value: idOf(direct.value) };
    if (/id$/i.test(filterKey) && filterKey.length > 2) {
        const navigation = lookup(row, filterKey.slice(0, -2));
        if (navigation.found) return { found: true, value: idOf(navigation.value) };
    }
    return { found: false, value: undefined };
}

export function matchesPickerFilters(row: Record<string, unknown>, filters?: Record<string, string>): boolean {
    if (!filters) return true;
    return Object.entries(filters).every(([filterKey, expected]) => {
        if (/^prefer/i.test(filterKey)) return true;
        if (filterKey.toLowerCase() === 'excludeids') {
            const excluded = String(expected).split(',').map(part => part.trim()).filter(Boolean);
            return !excluded.includes(String(idOf(row)));
        }
        const { found, value } = rowFilterValue(row, filterKey);
        if (!found) return false;
        if (!present(value)) return false;
        return String(value).toLowerCase() === String(expected).trim().toLowerCase();
    });
}

/**
 * Stable key for a table row: an enchantment ref by its namespaceKey (its unique identifier), any
 * other row by id, an unsaved hybrid option by namespaceKey/blockStateString, else its position.
 */
export function tableRowKey(row: Record<string, unknown>, entityTypeName: string, index: number): string {
    if (entityTypeName.toLowerCase() === 'minecraftenchantmentref' && present(row.namespaceKey)) {
        return `ns:${String(row.namespaceKey)}`;
    }
    const id = idOf(row);
    if (present(id)) return `id:${String(id)}`;
    if (present(row.blockStateString)) return `bs:${String(row.blockStateString)}`;
    if (present(row.namespaceKey)) return `ns:${String(row.namespaceKey)}`;
    return `index:${index}`;
}

/**
 * Whether two values are the same selection: enchantment refs by namespaceKey, rows with an id by
 * id, id-less values only when they are the same object (two unsaved items are not equal).
 */
export function isSameSelection(a: Record<string, unknown>, b: Record<string, unknown>, entityTypeName: string): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (entityTypeName.toLowerCase() === 'minecraftenchantmentref') {
        return present(a.namespaceKey) && a.namespaceKey === b.namespaceKey;
    }
    const idA = idOf(a);
    const idB = idOf(b);
    return present(idA) && present(idB) && String(idA) === String(idB);
}

export interface PinnedSection<T> {
    /** Pinned rows to show above the page, each once, with page data where the page has the row. */
    pinned: Array<PinnedRow<T>>;
    /** The page rows that are not already shown as pinned rows. */
    pageItems: T[];
}

/**
 * Applies the search term and filters to the pinned rows and de-duplicates them against the page:
 * a row in both is shown once, in the pinned section, with the page's (database) data.
 */
export function buildPinnedSection<T extends Record<string, unknown>>(
    pinnedRows: Array<PinnedRow<T>> | undefined,
    pageItems: T[],
    searchTerm: string | undefined,
    filters: Record<string, string> | undefined
): PinnedSection<T> {
    if (!pinnedRows || pinnedRows.length === 0) {
        return { pinned: [], pageItems };
    }

    const pageById = new Map<string, T>();
    pageItems.forEach(item => {
        const id = idOf(item);
        if (present(id)) pageById.set(String(id), item);
    });

    const seen = new Set<string>();
    const pinned: Array<PinnedRow<T>> = [];
    pinnedRows.forEach(pin => {
        const id = idOf(pin.row);
        if (!present(id)) return;
        const idKey = String(id);
        if (seen.has(idKey)) return;
        const fromPage = pageById.get(idKey);
        if (!fromPage && !(matchesSearchTerm(pin.row, searchTerm) && matchesPickerFilters(pin.row, filters))) {
            return;
        }
        seen.add(idKey);
        pinned.push(fromPage ? { ...pin, row: fromPage } : pin);
    });

    return {
        pinned,
        pageItems: pageItems.filter(item => {
            const id = idOf(item);
            return !(present(id) && seen.has(String(id)));
        })
    };
}
