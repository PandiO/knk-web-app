/**
 * PandiO/knk-workspace#191: the form wizard's search-as-you-type relation picker (components/FormWizard/RelationPicker).
 * Pure parts: which search it runs for the viewer (#280: the full search with a read node of the type, else the
 * lookup), what a lookup does with the field's pickerFilters (#288), and the short second line of an option.
 */
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { PermissionStatus } from '../../hooks/useStaffAccess';
import { ColumnDefinition } from '../../types/common';
import { LookupItemDto } from '../../apiClients/lookupClient';
import { cellText } from '../tableCells';

/** Options per search: the first few matches, then "keep typing" or the full table. */
export const RELATION_PICKER_PAGE_SIZE = 8;
/** Typing pauses this long before the search runs (as the detail page's picker, #188). */
export const RELATION_PICKER_DELAY_MS = 250;

/**
 * How the picker searches (#280 AM2, DESIGN.md § 4.6.3):
 * - `full`: the type's own paged search (and the "Open full table" fallback), for a viewer holding one of its read
 *   nodes, or when the metadata names none (an API without the access model: it decides);
 * - `lookup`: `POST api/Lookup/{type}/search` (id + label + one line), for any area node without a read node;
 * - `none`: neither (no read node and the type has no lookup);
 * - `checking`: the permission answers aren't in yet.
 */
export type RelationAccess =
    | { mode: 'full' }
    | { mode: 'lookup'; nodes: string[] }
    | { mode: 'none'; nodes: string[] }
    | { mode: 'checking' };

export function relationAccess(
    meta: Pick<EntityMetadataDto, 'readNodes' | 'lookupSearchable'> | undefined,
    statuses: Record<string, PermissionStatus>
): RelationAccess {
    const nodes = (meta?.readNodes ?? []).filter(Boolean);
    if (nodes.length === 0) return { mode: 'full' };
    if (nodes.some(node => statuses[node] === 'allowed')) return { mode: 'full' };
    if (nodes.some(node => (statuses[node] ?? 'checking') === 'checking')) return { mode: 'checking' };
    return meta?.lookupSearchable === false ? { mode: 'none', nodes } : { mode: 'lookup', nodes };
}

/**
 * What a lookup does with the field's resolved pickerFilters (PandiO/knk-workspace#288, developer 2026-11-15: the
 * lookup applies the narrowing filters the type's own search accepts, labels only):
 * - `excludeIds` is applied here, on the page (the lookup doesn't take it);
 * - every other filter with a value goes to `api/Lookup/{type}/search`, `prefer…` ones included (the API orders by
 *   those it takes and leaves the rest out). A filter the type's lookup doesn't take comes back as a 400
 *   `LookupFilterNotAllowed` (see lookupFilterRefusal): the picker then says so instead of offering records the form
 *   would not accept (LV6-3).
 */
export function lookupFilterPlan(filters?: Record<string, string> | null): { excludeIds: Set<string>; filters: Record<string, string> } {
    const excludeIds = new Set<string>();
    const sent: Record<string, string> = {};
    Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value === undefined || value === null || String(value).trim() === '') return;
        if (key.toLowerCase() === 'excludeids') {
            String(value).split(',').map(part => part.trim()).filter(Boolean).forEach(id => excludeIds.add(id));
            return;
        }
        sent[key] = String(value).trim();
    });
    return { excludeIds, filters: sent };
}

/**
 * The filters a lookup refused because the type's lookup doesn't take them (400 `LookupFilterNotAllowed`, #288), or
 * undefined for any other answer. Only the full search of the type can narrow by those.
 */
export function lookupFilterRefusal(error: unknown): string[] | undefined {
    const e = error as { status?: number; response?: unknown } | null;
    if (e?.status !== 400) return undefined;
    const body = e.response as { error?: unknown; filters?: unknown } | null | undefined;
    if (!body || typeof body !== 'object' || body.error !== 'LookupFilterNotAllowed') return undefined;
    const keys = Array.isArray(body.filters) ? body.filters.filter((key): key is string => typeof key === 'string' && key !== '') : [];
    return keys.length > 0 ? keys : ['a filter'];
}

/**
 * A lookup row as the form keeps it: `{ id, name }`, the same shape as an edit-loaded reference (objectFieldEditValue),
 * so the field shows the label and submits the id (normalizeFormSubmission) like any picked row.
 */
export function lookupItemToValue(item: LookupItemDto): { id: number; name: string } {
    return { id: item.id, name: item.label };
}

const LABEL_KEYS = new Set(['id', 'name', 'displayname', 'title', 'label', 'username']);

/**
 * The option's second line in the full search: the first `max` table columns (the type's configured default columns,
 * KNG-166) that aren't the label or the id and have a value, as "Label: value · Label: value".
 */
export function optionDetail<T extends Record<string, unknown>>(row: T, columns: ColumnDefinition<T>[], max = 2): string | undefined {
    const parts: string[] = [];
    for (const column of columns) {
        if (parts.length >= max) break;
        if (LABEL_KEYS.has(column.key.toLowerCase())) continue;
        const text = cellText(row, column).trim();
        if (!text || text === '-') continue;
        parts.push(`${column.label}: ${text}`);
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
}
