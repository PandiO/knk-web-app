import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react';

/**
 * PandiO/knk-workspace#187 (X-9): the one table the web app's lists are built from. It draws; the caller
 * fetches, sorts and pages (the Pager below it). Built from what #39 added to `PagedEntityTable`, which now
 * renders through it:
 * - **Row links (CRUD-4):** with `rowHref` the link column's cell is a real `<a href>`, so middle-click,
 *   Ctrl/Cmd-click and the keyboard work. A plain click on the link or anywhere on the row calls `onRowClick`
 *   (the caller navigates in the app); Ctrl/Cmd-click or middle-click on the row opens the address in a new tab.
 *   With a link, controls inside the row (buttons, inputs, other links) keep their own clicks; without one, a
 *   control that should not open the row stops its click (as before #187).
 * - **Sorting:** a sortable header is a button inside a `<th aria-sort>`, so Tab reaches it, Enter/Space sort
 *   and screen readers hear the column and direction. `nextSort` gives the usual asc → desc → off cycle.
 * - Optional row sections with a heading row (the wizard pickers' "Created in this form"), a leading element
 *   per row (check mark, badge), selection styling, an actions column and an empty state.
 * - **Checkbox column (#205):** with `selection` the first column holds a checkbox per row and one in the header
 *   for the rows shown. A click anywhere in that cell toggles the row and never opens it, so the row links and the
 *   row click keep working beside it (the dashboard's bulk selection).
 * - **Row lines (#404):** the lines between rows sit on the cells (`border-separate`, one bottom line per cell), never
 *   on the `<tr>`: a row border shared the dividers' colour, so from the second row on a 4px left edge showed grey.
 *   The selected row's green edge is a bar inside its first cell.
 *
 *     <DataTable
 *       caption="Players"
 *       columns={[{ key: 'username', header: 'Username', sortable: true }, { key: 'coins', header: 'Coins', align: 'right',
 *                  cell: u => formatNumber(u.coins) }]}
 *       rows={users} rowKey={u => String(u.id)}
 *       sort={sort} onSortChange={key => setSort(nextSort(sort, key))}
 *       rowHref={u => `/admin/users/${u.id}`} onRowClick={u => navigate(`/admin/users/${u.id}`)}
 *       empty="No matching players."
 *     />
 *     <Pager page={page} pageSize={20} totalCount={total} onPageChange={setPage} />
 */

export interface DataTableColumn<T> {
    /** Unique per table; also the sort key and, without `cell`, the row property shown. */
    key: string;
    header: React.ReactNode;
    /** The cell's content; default `row[key]` as text, `-` when missing. */
    cell?: (row: T) => React.ReactNode;
    sortable?: boolean;
    align?: 'left' | 'right' | 'center';
    /** Extra classes on this column's cells (e.g. `font-mono text-xs`). */
    className?: string;
}

export interface DataTableSort {
    key: string;
    descending: boolean;
}

export interface DataTableRow<T> {
    key: string;
    row: T;
    /** Shown in the link column before the cell's content, e.g. a "New" badge. */
    leading?: React.ReactNode;
}

export interface DataTableSection<T> {
    key: string;
    /** A heading row above the section's rows; none for an unlabelled section. */
    label?: React.ReactNode;
    tone?: 'muted' | 'warning';
    rows: DataTableRow<T>[];
}

/** A checkbox column in front of the others (#205). */
export interface DataTableSelection<T> {
    isSelected: (row: T) => boolean;
    onToggle: (row: T) => void;
    /** The header checkbox: checked when every shown row is, mixed when some are. Without it, no header box. */
    onToggleAll?: () => void;
    /** The accessible name of a row's checkbox, e.g. "Select Northwatch"; default "Select row". */
    rowLabel?: (row: T) => string;
    /** The accessible name of the header checkbox; default "Select all rows on this page". */
    allLabel?: string;
}

export interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    /** The rows, with `rowKey`; or `sections` instead. */
    rows?: T[];
    rowKey?: (row: T, index: number) => string;
    sections?: DataTableSection<T>[];
    /** Read by screen readers as the table's name. */
    caption?: string;
    sort?: DataTableSort | null;
    /** Called with the column key when its sort button is pressed (see `nextSort`). */
    onSortChange?: (key: string) => void;
    /** The address a row opens (its detail page). */
    rowHref?: (row: T) => string | undefined;
    onRowClick?: (row: T) => void;
    /** Which column holds the row link and `leading`; default the first. */
    linkColumn?: string;
    isRowSelected?: (row: T) => boolean;
    /** A checkbox column for selecting rows next to the row links (#205); selected rows are highlighted. */
    selection?: DataTableSelection<T>;
    /** Shown before every row's content in the link column (after `leading`), e.g. a check mark. */
    rowLeading?: (row: T) => React.ReactNode;
    /** Buttons in a last, unlabelled "Actions" column. */
    rowActions?: (row: T) => React.ReactNode;
    /** Shown across the table when there are no rows. */
    empty?: React.ReactNode;
    /** A spinner in place of the table. */
    loading?: boolean;
    /** `comfortable` (default; the entity tables) or `compact` (lists inside cards). */
    density?: 'comfortable' | 'compact';
    /** Classes on the scroll container; default a panel. */
    className?: string;
}

/** The sort after pressing `key`'s header: ascending, then descending, then off. */
export const nextSort = (current: DataTableSort | null | undefined, key: string): DataTableSort | null => {
    if (!current || current.key !== key) return { key, descending: false };
    return current.descending ? null : { key, descending: true };
};

/** A click that should open the link the browser's way (new tab/window) instead of in the app. */
export const isModifiedClick = (event: React.MouseEvent): boolean =>
    event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** The click started on a control inside the row (a row action, the link itself). */
const isFromInteractiveElement = (event: React.MouseEvent): boolean => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest?.('a, button, input, select, textarea, label');
    return !!interactive && interactive !== event.currentTarget && event.currentTarget.contains(interactive);
};

const defaultCell = (row: unknown, key: string): React.ReactNode => {
    const value = (row as Record<string, unknown> | null)?.[key];
    if (value === null || value === undefined || value === '') return <span className="text-muted">-</span>;
    return String(value);
};

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
};

export function DataTable<T>({
    columns,
    rows,
    rowKey,
    sections,
    caption,
    sort,
    onSortChange,
    rowHref,
    onRowClick,
    linkColumn,
    isRowSelected,
    selection,
    rowLeading,
    rowActions,
    empty,
    loading = false,
    density = 'comfortable',
    className = 'panel bg-surface/95 backdrop-blur',
}: DataTableProps<T>) {
    const allSections: DataTableSection<T>[] = sections ?? [{
        key: 'rows',
        rows: (rows ?? []).map((row, index) => ({ key: rowKey ? rowKey(row, index) : String(index), row })),
    }];
    const rowCount = allSections.reduce((count, section) => count + section.rows.length, 0);
    const linkKey = linkColumn ?? columns[0]?.key;
    const columnCount = columns.length + (rowActions ? 1 : 0) + (selection ? 1 : 0);
    const allRows = allSections.flatMap(section => section.rows.map(entry => entry.row));
    const selectedShown = selection ? allRows.filter(row => selection.isSelected(row)).length : 0;
    const allShownSelected = allRows.length > 0 && selectedShown === allRows.length;
    const compact = density === 'compact';
    const cellPad = compact ? 'px-3 py-2' : 'px-6 py-4';
    const headPad = compact ? 'px-3 py-2' : 'px-6 py-3';

    const bodyCellLine = 'border-b border-line';

    const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
        sort?.key !== key ? 'none' : sort.descending ? 'descending' : 'ascending';

    const sortIcon = (key: string) => {
        if (sort?.key !== key) return <ArrowUpDown className="h-4 w-4" aria-hidden="true" />;
        return sort.descending
            ? <ArrowDown className="h-4 w-4" aria-hidden="true" />
            : <ArrowUp className="h-4 w-4" aria-hidden="true" />;
    };

    const renderRow = ({ key, row, leading }: DataTableRow<T>) => {
        const selected = isRowSelected?.(row) ?? selection?.isSelected(row) ?? false;
        const href = rowHref?.(row);
        const clickable = !!onRowClick || !!href;
        const openInNewTab = () => {
            if (href) window.open(href, '_blank', 'noopener');
        };
        return (
            <tr
                key={key}
                data-row-key={key}
                onClick={(event) => {
                    // With a link, its own click (and other controls') isn't the row's.
                    if (href && isFromInteractiveElement(event)) return;
                    if (href && (event.metaKey || event.ctrlKey)) {
                        openInNewTab();
                        return;
                    }
                    if (onRowClick) onRowClick(row);
                    else if (href) window.location.assign(href);
                }}
                onAuxClick={href ? (event) => {
                    // Middle-click anywhere on the row opens it in a new tab, like the link does.
                    if (event.button !== 1 || isFromInteractiveElement(event)) return;
                    event.preventDefault();
                    openInNewTab();
                } : undefined}
                className={`transition-colors duration-150 ${
                    selected
                        ? 'bg-success-soft hover:bg-success-muted'
                        : 'hover:bg-surface-alt'
                } ${clickable ? 'cursor-pointer' : ''}`}
            >
                {selection && (
                    // The whole cell toggles the box; its clicks never reach the row (no navigation).
                    <td
                        className={`${compact ? 'pl-3 pr-1' : 'pl-4 pr-2'} relative w-px whitespace-nowrap align-middle ${bodyCellLine}`}
                        onClick={(event) => event.stopPropagation()}
                        onAuxClick={(event) => event.stopPropagation()}
                    >
                        {selected && <SelectedEdge />}
                        <label className="-m-2 flex cursor-pointer items-center justify-center p-2">
                            <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-primary"
                                checked={selection.isSelected(row)}
                                onChange={() => selection.onToggle(row)}
                                aria-label={selection.rowLabel?.(row) ?? 'Select row'}
                                data-testid="row-select"
                            />
                        </label>
                    </td>
                )}
                {columns.map((column, columnIndex) => {
                    const content = column.cell ? column.cell(row) : defaultCell(row, column.key);
                    const edgeHere = selected && !selection && columnIndex === 0;
                    const isLinkCell = column.key === linkKey;
                    const lead = isLinkCell ? (
                        <>
                            {rowLeading?.(row)}
                            {leading}
                        </>
                    ) : null;
                    return (
                        <td
                            key={column.key}
                            className={`${cellPad} text-sm ${compact ? '' : 'whitespace-nowrap'} ${ALIGN[column.align ?? 'left']} ${
                                selected ? 'text-fg font-medium' : isLinkCell ? 'text-fg' : 'text-muted'
                            } ${edgeHere ? 'relative' : ''} ${bodyCellLine} ${column.className ?? ''}`}
                        >
                            {edgeHere && <SelectedEdge />}
                            {isLinkCell && (rowLeading || leading || href) ? (
                                <div className="flex items-center gap-2">
                                    {lead}
                                    {href ? (
                                        <a
                                            href={href}
                                            className="text-fg hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                // Ctrl/Cmd/Shift/middle click: the browser opens the address.
                                                if (isModifiedClick(event) || !onRowClick) return;
                                                event.preventDefault();
                                                onRowClick(row);
                                            }}
                                        >
                                            {content}
                                        </a>
                                    ) : (
                                        <span>{content}</span>
                                    )}
                                </div>
                            ) : content}
                        </td>
                    );
                })}
                {rowActions && (
                    <td className={`${cellPad} whitespace-nowrap text-right text-sm font-medium ${bodyCellLine}`}>
                        <div className="flex items-center justify-end gap-2">{rowActions(row)}</div>
                    </td>
                )}
            </tr>
        );
    };

    return (
        <div className={`w-full overflow-x-auto ${className}`}>
            {loading ? (
                <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" aria-hidden="true" />
                </div>
            ) : (
                // #404: border-separate keeps every line on the cells, never on a row.
                <table className="w-full min-w-full border-separate border-spacing-0">
                    {caption && <caption className="sr-only">{caption}</caption>}
                    <thead className="bg-surface-alt">
                        <tr className="bg-surface-alt">
                            {selection && (
                                <th scope="col" className={`${compact ? 'pl-3 pr-1' : 'pl-4 pr-2'} w-px py-3 text-left align-middle border-b border-line`}>
                                    {selection.onToggleAll ? (
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 cursor-pointer accent-primary"
                                            checked={allShownSelected}
                                            ref={(input) => {
                                                if (input) input.indeterminate = selectedShown > 0 && !allShownSelected;
                                            }}
                                            onChange={() => selection.onToggleAll?.()}
                                            disabled={allRows.length === 0}
                                            aria-label={selection.allLabel ?? 'Select all rows on this page'}
                                            data-testid="select-all"
                                        />
                                    ) : (
                                        <span className="sr-only">Select</span>
                                    )}
                                </th>
                            )}
                            {columns.map(column => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    aria-sort={column.sortable ? ariaSort(column.key) : undefined}
                                    className={`${headPad} ${ALIGN[column.align ?? 'left']} border-b border-line text-xs font-medium text-muted uppercase tracking-wider ${
                                        column.sortable ? 'hover:bg-canvas transition-colors' : ''
                                    }`}
                                >
                                    {column.sortable ? (
                                        <button
                                            type="button"
                                            onClick={() => onSortChange?.(column.key)}
                                            className={`inline-flex items-center gap-1 uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm ${
                                                column.align === 'right' ? 'flex-row-reverse' : ''
                                            }`}
                                        >
                                            <span>{column.header}</span>
                                            {sortIcon(column.key)}
                                        </button>
                                    ) : (
                                        column.header
                                    )}
                                </th>
                            ))}
                            {rowActions && (
                                <th scope="col" className={`relative ${headPad} border-b border-line`}>
                                    <span className="sr-only">Actions</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="[&>tr:last-child>td]:border-b-0">
                        {rowCount === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className={`${compact ? 'px-3 py-6' : 'px-6 py-12'} text-center text-sm text-muted`}>
                                    {empty ?? 'No results found'}
                                </td>
                            </tr>
                        ) : allSections.map(section => (
                            <React.Fragment key={section.key}>
                                {section.label && section.rows.length > 0 && (
                                    <tr className={section.tone === 'warning' ? 'bg-warning-soft/60' : 'bg-surface-alt'}>
                                        <td
                                            colSpan={columnCount}
                                            className={`${compact ? 'px-3' : 'px-6'} ${bodyCellLine} py-2 text-left text-xs font-semibold uppercase tracking-wider ${
                                                section.tone === 'warning' ? 'text-warning-strong' : 'text-muted'
                                            }`}
                                        >
                                            {section.label}
                                        </td>
                                    </tr>
                                )}
                                {section.rows.map(renderRow)}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

/** #404: the selected row's green edge, inside its first cell (a row border would collide with the row lines). */
const SelectedEdge = () => (
    <span aria-hidden="true" data-testid="selected-edge" className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-success" />
);
