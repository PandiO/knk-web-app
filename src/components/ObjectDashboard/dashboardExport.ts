import { dashboardClient } from '../../apiClients/dashboardClient';
import { ColumnDefinition } from '../../types/common';
import { PagedQueryDto } from '../../types/dtos/common/PagedQuery';
import { buildTableCsv, EXPORT_ROW_LIMIT, ExportRows, readExportRows } from '../../utils/tableExport';
import { csvFileName, downloadCsv } from '../../utils/csv';
import { formatNumber } from '../../utils/format';
import { toast } from '../../utils/toast';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

/**
 * PandiO/knk-workspace#205 (export), shared by the bulk bar's Export CSV and the row menu's Export (#406): read the rows
 * with `POST api/Dashboard/export` (the `selected` rows by id, or with none the whole search of `query`), write
 * `<Type>-<yyyy-mm-dd>.csv` with the table's columns and say how it went in a toast.
 *
 * `isCancelled` is asked once the server answered (the read itself can't be stopped); `cancelledNotice` then says so.
 * Permission is the caller's: the type's `actionNodes.export` (#280 DESIGN § 4.8).
 */
export interface DashboardExportRequest<T> {
    entityTypeName: string;
    typeLabel: string;
    columns: ColumnDefinition<T>[];
    selected: T[];
    query: PagedQueryDto;
    isCancelled?: () => boolean;
    /** Whether to toast "Export cancelled" after a cancel (false once the page is gone). */
    cancelledNotice?: () => boolean;
}

export async function exportDashboardRows<T extends Record<string, any>>({
    entityTypeName,
    typeLabel,
    columns,
    selected,
    query,
    isCancelled = () => false,
    cancelledNotice = () => true,
}: DashboardExportRequest<T>): Promise<void> {
    try {
        const rows: ExportRows<T> = await readExportRows<T>(
            scope => dashboardClient.export<T>(entityTypeName, scope), selected, query);
        if (isCancelled()) {
            if (cancelledNotice()) toast.info('Export cancelled');
            return;
        }
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
        if (isCancelled()) return;
        console.error('Export failed', error);
        toast.error(`Export failed: ${apiRefusalReason(error) ?? `the ${typeLabel} rows could not be loaded.`}`, {});
    }
}
