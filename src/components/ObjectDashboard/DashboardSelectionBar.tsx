import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { SelectionBarState } from '../PagedEntityTable/PagedEntityTable';
import { EntityGate } from '../../hooks/useEntityAccess';
import { EXPORT_ROW_LIMIT } from '../../utils/tableExport';
import { formatNumber } from '../../utils/format';
import { exportDashboardRows } from './dashboardExport';

/**
 * PandiO/knk-workspace#205 (export): the dashboard's bulk bar above the table.
 *
 * - Says how many rows are selected (checkbox column) and clears them.
 * - **Export CSV:** the selected rows, or with nothing selected the current search across all pages in the current
 *   sort, with the table's columns in table order and the values the cells show; at most `EXPORT_ROW_LIMIT` rows,
 *   said beforehand in the bar and afterwards in a toast. The file is `<Type>-<yyyy-mm-dd>.csv`, UTF-8 with BOM.
 * - **Rows** (#280 AM3): read by `POST api/Dashboard/export` (one call, one audit entry); a selection is re-read by
 *   id and kept in the order it was ticked.
 * - **Permission:** the type's `actionNodes.export` (the area node + `knk.admin.export`, #280 DESIGN § 4.8), given as
 *   `exportGate`; without it the button is disabled with "Requires …".
 * - **`actions`:** the slot before Export for "Delete (n)" (#205 bulk delete, hidden without its nodes).
 */
export interface DashboardSelectionBarProps<T> {
    state: SelectionBarState<T>;
    /** The entity type (list API and file name), e.g. "Town". */
    entityTypeName: string;
    /** How the type is called on the page, e.g. "Town" or "Item Blueprint". */
    typeLabel: string;
    /** Whether Export may be used (`useEntityAccess(meta).export`). */
    exportGate: Pick<EntityGate, 'allowed' | 'checking' | 'hint'>;
    /** More bulk actions before Export ("Delete (n)"). */
    actions?: React.ReactNode;
    /** An action of `actions` is running: Clear and Export wait. */
    busy?: boolean;
}

interface Progress {
    total: number;
}

export function DashboardSelectionBar<T extends Record<string, any>>({
    state,
    entityTypeName,
    typeLabel,
    exportGate,
    actions,
    busy = false,
}: DashboardSelectionBarProps<T>) {
    const { selected, clearSelection, columns, query, totalCount, loading } = state;
    const canExport = exportGate.allowed;
    const exportHint = exportGate.checking ? null : exportGate.hint;
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
        setProgress({ total: count > 0 ? count : totalCount });
        try {
            await exportDashboardRows<T>({
                entityTypeName,
                typeLabel,
                columns,
                selected,
                query,
                isCancelled: () => cancelled.current,
                cancelledNotice: () => mounted.current,
            });
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
                        disabled={!!progress || busy}
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
                {/* #205: "Delete (n)", shown only with the bulk delete nodes (#280 DESIGN § 4.7). */}
                {actions}
                <button
                    type="button"
                    onClick={() => void runExport()}
                    disabled={!canExport || !!progress || busy || (count === 0 && (loading || totalCount === 0))}
                    className="btn-secondary h-9 whitespace-nowrap"
                    title={exportTitle}
                    aria-describedby={exportHint && !canExport ? hintId : undefined}
                    data-testid="export-csv"
                >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {progress
                        ? `Exporting ${formatNumber(Math.min(progress.total, EXPORT_ROW_LIMIT))}…`
                        : count > 0 ? `Export CSV (${formatNumber(count)})` : 'Export CSV'}
                </button>
                {progress && (
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
