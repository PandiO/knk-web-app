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

import { normalizeBlockStateString, normalizeNamespaceKey } from '../minecraftKeys';

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

/**
 * The row's database id, or undefined when it has none. Ids start at 1, so 0 (or "0") is no id: the
 * hybrid Minecraft search returned unsaved catalogue rows with `id: 0` before KNG-200 (`null` since).
 */
const savedIdOf = (value: unknown): unknown => {
    const id = idOf(value);
    return present(id) && String(id).trim() !== '0' ? id : undefined;
};

const MATERIAL_REF = 'minecraftmaterialref';
const BLOCK_REF = 'minecraftblockref';
const ENCHANTMENT_REF = 'minecraftenchantmentref';

/**
 * KNG-200: the identity of a Minecraft catalogue row apart from its id. A material ref is its
 * normalised namespaceKey, a block ref its normalised namespaceKey plus block state, an enchantment
 * ref its namespaceKey as given (unchanged). Undefined for other entity types or a row without a key.
 */
export function catalogKeyOf(row: Record<string, unknown> | null | undefined, entityTypeName: string): string | undefined {
    if (!row) return undefined;
    const type = entityTypeName.toLowerCase();
    if (type === ENCHANTMENT_REF) {
        return present(row.namespaceKey) ? String(row.namespaceKey) : undefined;
    }
    if (type === MATERIAL_REF) {
        return normalizeNamespaceKey(row.namespaceKey) || undefined;
    }
    if (type === BLOCK_REF) {
        const namespaceKey = normalizeNamespaceKey(row.namespaceKey);
        const state = normalizeBlockStateString(row.blockStateString);
        return namespaceKey || state ? `${namespaceKey}|${state}` : undefined;
    }
    return undefined;
}

export function matchesSearchTerm(row: Record<string, unknown>, searchTerm?: string): boolean {
    const term = (searchTerm ?? '').trim().toLowerCase();
    if (!term) return true;
    const id = savedIdOf(row);
    if (id !== undefined && String(id).toLowerCase() === term) return true;
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
 * other row by id (0 is no id), an unsaved material ref by its normalised namespaceKey, an unsaved
 * block ref by normalised namespaceKey + block state (KNG-200), else by namespaceKey/blockStateString
 * or its position.
 */
export function tableRowKey(row: Record<string, unknown>, entityTypeName: string, index: number): string {
    const type = entityTypeName.toLowerCase();
    if (type === ENCHANTMENT_REF && present(row.namespaceKey)) {
        return `ns:${String(row.namespaceKey)}`;
    }
    const id = savedIdOf(row);
    if (id !== undefined) return `id:${String(id)}`;
    const catalogKey = catalogKeyOf(row, entityTypeName);
    if (catalogKey !== undefined) return `${type === BLOCK_REF ? 'bs' : 'ns'}:${catalogKey}`;
    if (present(row.blockStateString)) return `bs:${String(row.blockStateString)}`;
    if (present(row.namespaceKey)) return `ns:${String(row.namespaceKey)}`;
    return `index:${index}`;
}

/**
 * Whether two values are the same selection: enchantment refs by namespaceKey, two rows with an id
 * by id (0 is no id). When one of them has no id, a material ref compares by normalised
 * namespaceKey and a block ref by normalised namespaceKey + block state (KNG-200); any other
 * id-less value only matches itself (two unsaved items are not equal).
 */
export function isSameSelection(a: Record<string, unknown>, b: Record<string, unknown>, entityTypeName: string): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (entityTypeName.toLowerCase() === ENCHANTMENT_REF) {
        return present(a.namespaceKey) && a.namespaceKey === b.namespaceKey;
    }
    const idA = savedIdOf(a);
    const idB = savedIdOf(b);
    if (idA !== undefined && idB !== undefined) return String(idA) === String(idB);
    const keyA = catalogKeyOf(a, entityTypeName);
    return keyA !== undefined && keyA === catalogKeyOf(b, entityTypeName);
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
        const id = savedIdOf(item);
        if (id !== undefined) pageById.set(String(id), item);
    });

    const seen = new Set<string>();
    const pinned: Array<PinnedRow<T>> = [];
    pinnedRows.forEach(pin => {
        const id = savedIdOf(pin.row);
        if (id === undefined) return;
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
            const id = savedIdOf(item);
            return !(id !== undefined && seen.has(String(id)));
        })
    };
}
