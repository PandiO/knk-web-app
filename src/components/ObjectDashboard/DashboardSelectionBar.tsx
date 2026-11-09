import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { SelectionBarState } from '../PagedEntityTable/PagedEntityTable';
import { EXPORT_PERMISSION_NODE, usePermissions } from '../../hooks/useStaffAccess';
import { getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { buildTableCsv, EXPORT_ROW_LIMIT, ExportCancelledError, ExportRows, readSearchRows, selectionRows } from '../../utils/tableExport';
import { csvFileName, downloadCsv } from '../../utils/csv';
import { formatNumber } from '../../utils/format';
import { toast } from '../../utils/toast';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

/**
 * PandiO/knk-workspace#205 (export): the dashboard's bulk bar above the table.
 *
 * - Says how many rows are selected (checkbox column) and clears them.
 * - **Export CSV:** the selected rows, or with nothing selected the current search across all pages in the current
 *   sort, with the table's columns in table order and the values the cells show; at most `EXPORT_ROW_LIMIT` rows,
 *   said beforehand in the bar and afterwards in a toast. The file is `<Type>-<yyyy-mm-dd>.csv`, UTF-8 with BOM.
 * - **Permission:** needs `knk.admin.export` (#280 DESIGN § 4.8); without it the button is disabled with
 *   "Requires knk.admin.export". Until the API knows the node (link AM1) only `*` and `knk.admin.*` match it, so the
 *   owner and Admin. The API's list reads stay the real limit (export is a convenience, not a data barrier).
 * - **`actions`:** the slot before Export for link AM3's "Delete (n)" (shown only with `knk.admin.delete.bulk`).
 *
 * AM3 replaces `readSearchRows` / `selectionRows` with `POST api/Dashboard/export`, whose answer has the same
 * `{ items, total, truncated }` shape; `buildTableCsv` stays.
 */
export interface DashboardSelectionBarProps<T> {
    state: SelectionBarState<T>;
    /** The entity type (list API and file name), e.g. "Town". */
    entityTypeName: string;
    /** How the type is called on the page, e.g. "Town" or "Item Blueprint". */
    typeLabel: string;
    /** More bulk actions before Export (AM3: "Delete (n)"). */
    actions?: React.ReactNode;
}

interface Progress {
    read: number;
    total: number;
}

export function DashboardSelectionBar<T extends Record<string, any>>({
    state,
    entityTypeName,
    typeLabel,
    actions,
}: DashboardSelectionBarProps<T>) {
    const { selected, clearSelection, columns, query, totalCount, loading } = state;
    const exportStatus = usePermissions([EXPORT_PERMISSION_NODE])[EXPORT_PERMISSION_NODE];
    const canExport = exportStatus === 'allowed';
    const exportHint = exportStatus === 'error'
        ? `Couldn't check ${EXPORT_PERMISSION_NODE}`
        : exportStatus === 'denied' || exportStatus === 'unauthenticated' ? `Requires ${EXPORT_PERMISSION_NODE}` : null;
    const hintId = useId();

    const [progress, setProgress] = useState<Progress | null>(null);
    const cancelled = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            cancelled.current = true;
        };
    }, []);

    const count = selected.length;
    const overLimit = canExport && count === 0 && totalCount > EXPORT_ROW_LIMIT;

    const runExport = async () => {
        if (progress || !canExport) return;
        cancelled.current = false;
        setProgress({ read: 0, total: count > 0 ? count : totalCount });
        try {
            const rows: ExportRows<T> = count > 0
                ? selectionRows(selected)
                : await readSearchRows<T>(getSearchFunctionForEntity(entityTypeName), query, {
                    onProgress: (read, total) => {
                        if (mounted.current) setProgress({ read, total });
                    },
                    isCancelled: () => cancelled.current,
                });
            if (rows.items.length === 0) {
                toast.info(`Nothing to export: no ${typeLabel} rows match the search.`);
                return;
            }
            downloadCsv(csvFileName(entityTypeName), buildTableCsv(columns, rows.items));
            if (rows.truncated) {
                toast.warning(
                    `Exported the first ${formatNumber(rows.items.length)} of ${formatNumber(rows.total)} ${typeLabel} rows: `
                    + `an export holds at most ${formatNumber(EXPORT_ROW_LIMIT)}. Narrow the search to export the rest.`,
                    { durationMs: null }
                );
            } else {
                toast.success(`Exported ${formatNumber(rows.items.length)} ${typeLabel} row${rows.items.length === 1 ? '' : 's'}`);
            }
        } catch (error) {
            if (error instanceof ExportCancelledError) {
                if (mounted.current) toast.info('Export cancelled');
                return;
            }
            console.error('Export failed', error);
            toast.error(`Export failed: ${apiRefusalReason(error) ?? `the ${typeLabel} rows could not be loaded.`}`, {});
        } finally {
            if (mounted.current) setProgress(null);
        }
    };

    const exportTitle = !canExport
        ? exportHint ?? undefined
        : count > 0
            ? `Export the ${formatNumber(count)} selected row${count === 1 ? '' : 's'} as CSV`
            : `Export all ${formatNumber(Math.min(totalCount, EXPORT_ROW_LIMIT))} rows of the current search as CSV`;

    return (
        <div
            role="region"
            aria-label={`${typeLabel} selection`}
            data-testid="selection-bar"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-surface/95 px-3 py-2 text-sm backdrop-blur"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span aria-live="polite" className={count > 0 ? 'font-medium text-fg' : 'text-muted'} data-testid="selection-count">
                    {count > 0
                        ? `${formatNumber(count)} selected`
                        : loading || !canExport ? 'None selected' : `None selected · Export takes all ${formatNumber(totalCount)} results`}
                </span>
                {count > 0 && (
                    <button
                        type="button"
                        onClick={clearSelection}
                        className="btn-tertiary px-2 py-1"
                        disabled={!!progress}
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Clear
                    </button>
                )}
                {overLimit && (
                    <span className="text-xs text-warning-strong" data-testid="export-limit">
                        Only the first {formatNumber(EXPORT_ROW_LIMIT)} go into the file (limit).
                    </span>
                )}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {/* Link AM3 adds "Delete (n)" here, shown only with knk.admin.delete.bulk (#280 DESIGN § 4.7). */}
                {actions}
                <button
                    type="button"
                    onClick={() => void runExport()}
                    disabled={!canExport || !!progress || (count === 0 && (loading || totalCount === 0))}
                    className="btn-secondary h-9 whitespace-nowrap"
                    title={exportTitle}
                    aria-describedby={exportHint && !canExport ? hintId : undefined}
                    data-testid="export-csv"
                >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {progress
                        ? `Exporting… ${formatNumber(progress.read)} / ${formatNumber(Math.min(progress.total, EXPORT_ROW_LIMIT))}`
                        : count > 0 ? `Export CSV (${formatNumber(count)})` : 'Export CSV'}
                </button>
                {progress && count === 0 && (
                    <button type="button" onClick={() => { cancelled.current = true; }} className="btn-tertiary h-9">
                        Cancel
                    </button>
                )}
                {exportHint && !canExport && (
                    <span id={hintId} className="text-xs text-muted" data-testid="export-hint">{exportHint}</span>
                )}
            </div>
        </div>
    );
}
