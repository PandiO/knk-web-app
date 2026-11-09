import type { ReactNode } from 'react';
import { ColumnDefinition } from '../types/common';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { cellText, reactNodeToText } from './tableCells';
import { toCsv } from './csv';

/**
 * PandiO/knk-workspace#205 (export): the rows of a dashboard table as CSV.
 *
 * - **Columns:** the table's columns in table order (`PagedEntityTable` hands them to its selection bar), with the
 *   readable values the cells show (`cellText`).
 * - **Rows:** the selected rows, or with nothing selected the current search across all pages, in the current sort
 *   (`readSearchRows` pages through the list API).
 * - **Limit:** `EXPORT_ROW_LIMIT` rows; beyond that the result says `truncated`.
 *
 * The result of `readSearchRows` has the shape of the API's planned `POST api/Dashboard/export` answer
 * (`{ items, total, truncated }`, #280 DESIGN § 4.8), so link AM3 swaps the data source and keeps `buildTableCsv`.
 */

/** At most this many rows go into one file (#280 DESIGN § 4.8: the export endpoint's cap). */
export const EXPORT_ROW_LIMIT = 10000;

/** Rows asked per list request. Some list endpoints clamp to fewer; the paging follows what they return. */
export const EXPORT_PAGE_SIZE = 100;

export interface ExportRows<T> {
    items: T[];
    /** Rows the search has in all (or the selection's size). */
    total: number;
    /** More than `EXPORT_ROW_LIMIT` rows: only the first ones are in `items`. */
    truncated: boolean;
}

export interface ReadSearchOptions {
    limit?: number;
    pageSize?: number;
    /** Rows read so far and the total, after each page. */
    onProgress?: (read: number, total: number) => void;
    /** Checked between pages; true stops the reading with an `ExportCancelledError`. */
    isCancelled?: () => boolean;
}

export class ExportCancelledError extends Error {
    constructor() {
        super('Export cancelled');
        this.name = 'ExportCancelledError';
    }
}

const rowId = (row: unknown): string | undefined => {
    const id = (row as { id?: unknown } | null)?.id;
    return id === null || id === undefined ? undefined : String(id);
};

/**
 * Every row of `query`'s search (its search term, filters and sort; page and page size are the export's own), page
 * by page, up to `limit`. A row whose id an earlier page already held (rows added meanwhile shift the pages) is
 * skipped.
 */
export async function readSearchRows<T>(
    search: (query: PagedQueryDto) => Promise<PagedResultDto<T>>,
    query: PagedQueryDto,
    { limit = EXPORT_ROW_LIMIT, pageSize = EXPORT_PAGE_SIZE, onProgress, isCancelled }: ReadSearchOptions = {}
): Promise<ExportRows<T>> {
    const items: T[] = [];
    const seen = new Set<string>();
    let total = 0;
    let page = 1;
    for (;;) {
        if (isCancelled?.()) throw new ExportCancelledError();
        const result = await search({ ...query, page, pageSize });
        if (isCancelled?.()) throw new ExportCancelledError();
        total = Math.max(result?.totalCount ?? 0, 0);
        const pageItems = result?.items ?? [];
        for (const row of pageItems) {
            if (items.length >= limit) break;
            const id = rowId(row);
            if (id !== undefined) {
                if (seen.has(id)) continue;
                seen.add(id);
            }
            items.push(row);
        }
        onProgress?.(items.length, total);
        const lastPage = result?.totalPages && result.totalPages > 0
            ? result.totalPages
            : Math.ceil(total / Math.max(result?.pageSize || pageSize, 1));
        if (items.length >= limit || pageItems.length === 0 || page >= lastPage) break;
        page += 1;
    }
    return { items, total: Math.max(total, items.length), truncated: total > items.length && items.length >= limit };
}

/** The selected rows as an export, capped at `limit` like a search. */
export const selectionRows = <T,>(selected: readonly T[], limit = EXPORT_ROW_LIMIT): ExportRows<T> => ({
    items: selected.slice(0, limit),
    total: selected.length,
    truncated: selected.length > limit,
});

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
