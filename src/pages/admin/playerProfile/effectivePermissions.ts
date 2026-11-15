import type { DataTableSort } from '../../../components/DataTable';
import type { EffectivePermissionEntryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';

/**
 * PandiO/knk-workspace#407: search and sort for the player profile's Effective Permissions list. The list
 * comes from the profile summary in the API's order; with no search and no sort it is shown as it comes.
 */

/** The sortable columns of the list. */
export type EffectivePermissionSortKey = 'node' | 'value' | 'source';

/** A node granted or denied directly on the player (the only rows the profile can remove). */
export const isDirectGrant = (entry: EffectivePermissionEntryDto): boolean => entry.sourceHolderType === 'User';

/** The Source column's text: "Direct grant", or the group's name ("Group #<id>" without one). */
export function permissionSourceLabel(entry: EffectivePermissionEntryDto): string {
    if (isDirectGrant(entry)) return 'Direct grant';
    return entry.sourceHolderName || `Group #${entry.sourceHolderId}`;
}

/** The Value column's text. */
export const permissionValueLabel = (entry: EffectivePermissionEntryDto): string => (entry.value ? 'Granted' : 'Denied');

/**
 * The rows whose node or source contains `query` (case-insensitive, trimmed). "direct" finds the direct
 * grants, a group's name finds what that group gives. An empty query keeps every row in its order.
 */
export function filterEffectivePermissions(
    entries: readonly EffectivePermissionEntryDto[],
    query: string,
): EffectivePermissionEntryDto[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [...entries];
    return entries.filter(entry =>
        entry.node.toLowerCase().includes(needle) || permissionSourceLabel(entry).toLowerCase().includes(needle));
}

const compareText = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base' });

const SORT_TEXT: Record<EffectivePermissionSortKey, (entry: EffectivePermissionEntryDto) => string> = {
    node: entry => entry.node,
    value: permissionValueLabel,
    source: permissionSourceLabel,
};

const isSortKey = (key: string): key is EffectivePermissionSortKey => key in SORT_TEXT;

/**
 * The rows sorted by the column's shown text (Value: Denied before Granted ascending), ties by node; no sort
 * (or an unknown column) keeps the given order. Never changes `entries`.
 */
export function sortEffectivePermissions(
    entries: readonly EffectivePermissionEntryDto[],
    sort: DataTableSort | null | undefined,
): EffectivePermissionEntryDto[] {
    if (!sort || !isSortKey(sort.key)) return [...entries];
    const text = SORT_TEXT[sort.key];
    const direction = sort.descending ? -1 : 1;
    return [...entries].sort((a, b) => {
        const byColumn = compareText(text(a), text(b));
        if (byColumn !== 0) return byColumn * direction;
        return compareText(a.node, b.node) * direction;
    });
}
