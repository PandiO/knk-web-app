import { ObjectManager } from './objectManager';
import { logging, Controllers, HttpMethod } from '../utils';

/** One row the bulk delete left alone (knk-web-api `DashboardBulkDeleteRefusalDto`). */
export interface BulkDeleteRefusalDto {
  id: number;
  /** Worded as the single delete's answer would be. */
  reason: string;
  /** `InUse` (other records still use it: "Show what uses it"), `NotFound`, `Refused` (a rule) or `Failed`. Absent on an older API. */
  code?: 'InUse' | 'NotFound' | 'Refused' | 'Failed' | string;
}

export interface BulkDeleteResponseDto {
  deleted: number[];
  refused: BulkDeleteRefusalDto[];
}

/** The search an export reads: the dashboard table's own search, filters and sort, all pages. */
export interface DashboardExportQueryDto {
  searchTerm?: string | null;
  filters?: Record<string, string>;
  sortBy?: string | null;
  sortDescending?: boolean;
}

export interface DashboardExportResponseDto<T = Record<string, unknown>> {
  items: T[];
  /** Rows in the scope: the search's total, or the selected ids found. */
  total: number;
  /** More rows than returned (the 10 000-row cap). */
  truncated: boolean;
}

/** At most this many ids per bulk delete call (knk-web-api `DashboardActionService.MaxBulkDeleteIds`). */
export const BULK_DELETE_MAX_IDS = 100;

/** Both actions run one save or one search page per row block on the server: give them more than the usual 15 s. */
export const DASHBOARD_ACTION_TIMEOUT_MS = 120 * 1000;

/**
 * `api/Dashboard` (PandiO/knk-workspace#280 AM1, DESIGN.md § 4.7, § 4.8): web users only.
 * - `bulkDelete`: knk.admin.delete.bulk + knk.admin.delete + the type's area node; 1–100 ids; not for users and
 *   permission groups (400 `BulkDeleteNotAllowed`). Each row goes through the type's own delete.
 * - `export`: knk.admin.export + the area node; the selected ids or the whole search, at most 10 000 rows.
 * Both share the API's `lookup` rate limit (429 when exceeded).
 */
class DashboardClient extends ObjectManager {
  private static instance: DashboardClient;

  public static getInstance() {
    if (!DashboardClient.instance) {
      DashboardClient.instance = new DashboardClient();
      DashboardClient.instance.logger = logging.getLogger('DashboardClient');
    }
    return DashboardClient.instance;
  }

  bulkDelete(entityType: string, ids: number[]): Promise<BulkDeleteResponseDto> {
    return this.invokeServiceCall({ entityType, ids }, 'bulk-delete', Controllers.Dashboard, HttpMethod.Post, undefined,
      DASHBOARD_ACTION_TIMEOUT_MS);
  }

  export<T = Record<string, unknown>>(
    entityType: string,
    scope: { ids?: number[]; query?: DashboardExportQueryDto }
  ): Promise<DashboardExportResponseDto<T>> {
    return this.invokeServiceCall({ entityType, ...scope }, 'export', Controllers.Dashboard, HttpMethod.Post, undefined,
      DASHBOARD_ACTION_TIMEOUT_MS);
  }
}

export const dashboardClient = DashboardClient.getInstance();
