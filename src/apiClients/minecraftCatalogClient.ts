import { logging, Controllers, HttpMethod } from '../utils';
import { ObjectManager } from './objectManager';
import {
  MinecraftCatalogAuditDto,
  MinecraftCatalogBackfillResultDto,
  MinecraftCatalogScanDto,
  MinecraftMaterialMergeResultDto,
} from '../types/dtos/minecraftCatalog/MinecraftCatalogDtos';

/** How many scans the admin page lists by default (the API's own default). */
export const DEFAULT_SCAN_HISTORY_SIZE = 20;

// KNG-200 phase 3 (docs/specs/minecraft-catalog/IMPLEMENTATION_PLAN.md §5.2a): server scans, the
// audit, the backfill, the merge action and icon overrides under api/MinecraftCatalog. Every route
// needs knk.admin.content. Refusals come back as a plain-text or `{ message }` body, which
// serviceCall turns into the thrown Error's text (with `status`), e.g. the 409 for a second scan.
export class MinecraftCatalogClient extends ObjectManager {
  private static instance: MinecraftCatalogClient;

  public static getInstance() {
    if (!MinecraftCatalogClient.instance) {
      MinecraftCatalogClient.instance = new MinecraftCatalogClient();
      MinecraftCatalogClient.instance.logger = logging.getLogger('MinecraftCatalogClient');
    }
    return MinecraftCatalogClient.instance;
  }

  // ===== Scans

  /** Asks knk-plugin to scan the server registry. 409 while another scan is still active. */
  requestScan(): Promise<MinecraftCatalogScanDto> {
    return this.invokeServiceCall(null, 'scans', Controllers.MinecraftCatalog, HttpMethod.Post);
  }

  /** Newest first. */
  getScans(take: number = DEFAULT_SCAN_HISTORY_SIZE): Promise<MinecraftCatalogScanDto[]> {
    return this.invokeServiceCall({ take }, 'scans', Controllers.MinecraftCatalog, HttpMethod.Get);
  }

  getScan(id: number): Promise<MinecraftCatalogScanDto> {
    return this.invokeServiceCall(null, `scans/${id}`, Controllers.MinecraftCatalog, HttpMethod.Get);
  }

  cancelScan(id: number): Promise<MinecraftCatalogScanDto> {
    return this.invokeServiceCall(null, `scans/${id}/cancel`, Controllers.MinecraftCatalog, HttpMethod.Post);
  }

  // ===== Audit and clean-up

  getAudit(): Promise<MinecraftCatalogAuditDto> {
    return this.invokeServiceCall(null, 'audit', Controllers.MinecraftCatalog, HttpMethod.Get);
  }

  /** Idempotent: a second run reports zeros. */
  runBackfill(): Promise<MinecraftCatalogBackfillResultDto> {
    return this.invokeServiceCall(null, 'backfill', Controllers.MinecraftCatalog, HttpMethod.Post);
  }

  /** Repoints everything that references `sourceId` to `targetId`, then deletes the source. */
  mergeMaterial(sourceId: number, targetId: number): Promise<MinecraftMaterialMergeResultDto> {
    return this.invokeServiceCall(null, `materials/${sourceId}/merge-into/${targetId}`,
      Controllers.MinecraftCatalog, HttpMethod.Post);
  }

  /** A null URL clears the override, so the scanned icon shows again. Answers 204. */
  setIconOverride(materialId: number, iconUrlOverride: string | null): Promise<void> {
    return this.invokeServiceCall({ iconUrlOverride }, `materials/${materialId}/icon-override`,
      Controllers.MinecraftCatalog, HttpMethod.Put);
  }
}

export const minecraftCatalogClient = MinecraftCatalogClient.getInstance();
