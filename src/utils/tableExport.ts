import type { ReactNode } from 'react';
import { ColumnDefinition } from '../types/common';
import { PagedQueryDto } from '../types/dtos/common/PagedQuery';
import { cellText, reactNodeToText } from './tableCells';
import { toCsv } from './csv';

import { DashboardExportQueryDto, DashboardExportResponseDto } from '../apiClients/dashboardClient';

/**
 * PandiO/knk-workspace#205 (export): the rows of a dashboard table as CSV.
 *
 * - **Columns:** the table's columns in table order (`PagedEntityTable` hands them to its selection bar), with the
 *   readable values the cells show (`cellText`).
 * - **Rows** (#280 AM3): read on the server by `POST api/Dashboard/export` (knk.admin.export + the area node, one audit
 *   entry): the selected ids, or with nothing selected the current search across all pages in the current sort.
 * - **Limit:** `EXPORT_ROW_LIMIT` rows; beyond that the answer says `truncated`.
 */

/** At most this many rows go into one file (#280 DESIGN § 4.8: the export endpoint's cap). */
export const EXPORT_ROW_LIMIT = 10000;

export interface ExportRows<T> {
    items: T[];
    /** Rows the search has in all (or the selection's size). */
    total: number;
    /** More than `EXPORT_ROW_LIMIT` rows: only the first ones are in `items`. */
    truncated: boolean;
}

const rowId = (row: unknown): string | undefined => {
    const id = (row as { id?: unknown } | null)?.id;
    return id === null || id === undefined ? undefined : String(id);
};

/**
 * The export endpoint's query from the table's (search term, filters, sort; page and page size are the export's own).
 * Empty filters are left out and values sent as text, as the list search reads them.
 */
export function exportQueryOf(query: PagedQueryDto): DashboardExportQueryDto {
    const filters: Record<string, string> = {};
    Object.entries(query.filters ?? {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        filters[key] = String(value);
    });
    return {
        searchTerm: query.searchTerm?.trim() ? query.searchTerm : null,
        filters,
        sortBy: query.sortBy ?? null,
        sortDescending: query.sortDescending === true,
    };
}

/** The numeric ids of the selected rows, in the order they were ticked, each once. */
export function selectedIds(selected: readonly unknown[]): number[] {
    const ids: number[] = [];
    selected.forEach(row => {
        const id = Number(rowId(row));
        if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
    });
    return ids;
}

/**
 * The rows to export, read by the API (#280 AM3, DESIGN § 4.8):
 * - **selection:** the ticked ids, re-read (current values), in the order they were ticked (LV2-3; LAM3-4);
 * - **search** (nothing ticked): the whole current search in its sort, at most `EXPORT_ROW_LIMIT` rows.
 */
export async function readExportRows<T>(
    exportRows: (scope: { ids?: number[]; query?: DashboardExportQueryDto }) => Promise<DashboardExportResponseDto<T>>,
    selected: readonly unknown[],
    query: PagedQueryDto
): Promise<ExportRows<T>> {
    const ids = selectedIds(selected).slice(0, EXPORT_ROW_LIMIT);
    if (selected.length > 0) {
        const answer = await exportRows({ ids });
        const byId = new Map((answer?.items ?? []).map(row => [rowId(row), row]));
        const items = ids.map(id => byId.get(String(id))).filter((row): row is T => row !== undefined);
        return { items, total: selected.length, truncated: selected.length > EXPORT_ROW_LIMIT };
    }
    const answer = await exportRows({ query: exportQueryOf(query) });
    const items = answer?.items ?? [];
    return { items, total: Math.max(answer?.total ?? 0, items.length), truncated: answer?.truncated === true };
}

/** A column header as text (labels are strings; a node is read as text). */
const headerText = (label: unknown): string =>
    typeof label === 'string' ? label : reactNodeToText(label as ReactNode);

/** The CSV text (without BOM) of `rows` with `columns`: a header row of the labels, then one line per row. */
export function buildTableCsv<T>(columns: readonly ColumnDefinition<T>[], rows: readonly T[]): string {
    return toCsv([
        columns.map(column => headerText(column.label)),
        ...rows.map(row => columns.map(column => cellText(row, column))),
    ]);
}
