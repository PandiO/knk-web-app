// KNG-200 phase 3: the Minecraft catalogue maintenance API (api/MinecraftCatalog), contract v1 in
// docs/specs/minecraft-catalog/IMPLEMENTATION_PLAN.md §5.2a. Every route needs knk.admin.content.

export type MinecraftCatalogScanStatus = 'Requested' | 'Running' | 'Ingesting' | 'Completed' | 'Failed';

/** Statuses of a scan that is still going: the admin page polls it, and a new scan is refused (409). */
export const ACTIVE_SCAN_STATUSES: readonly MinecraftCatalogScanStatus[] = ['Requested', 'Running', 'Ingesting'];

export const isActiveScanStatus = (status: string | null | undefined): boolean =>
  ACTIVE_SCAN_STATUSES.includes(status as MinecraftCatalogScanStatus);

/** A server scan: the plugin reads the registry, the API ingests it (§5.1, §6). */
export interface MinecraftCatalogScanDto {
  id: number;
  status: MinecraftCatalogScanStatus;
  requestedByUserId: number | null;
  worldTaskId: number | null;
  minecraftVersion: string | null;
  serverVersion: string | null;
  entryCount: number | null;
  inserted: number;
  updated: number;
  unchanged: number;
  merged: number;
  deleted: number;
  markedMissing: number;
  iconsMissing: number;
  /**
   * KNG-250 (§12.2): enchantments the server sent, vanilla and custom; null for a schema 1 scan
   * (an older plugin), whose enchantment counters are all 0.
   */
  enchantmentCount: number | null;
  enchantmentsInserted: number;
  enchantmentsUpdated: number;
  enchantmentsUnchanged: number;
  enchantmentsMerged: number;
  enchantmentsDeleted: number;
  enchantmentsMarkedMissing: number;
  /** EnchantmentDefinitions the scan created for enchantments that had none (§12.4 step 5). */
  enchantmentDefinitionsCreated: number;
  /** Existing unlinked EnchantmentDefinitions the scan linked to their enchantment. */
  enchantmentDefinitionsLinked: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** A material row in the audit, with what references it. */
export interface MinecraftCatalogAuditMaterialDto {
  id: number;
  namespaceKey: string;
  /** Null when the key can't be normalised. */
  normalizedKey: string | null;
  displayName: string | null;
  catalogStatus: string;
  /** Count per referrer, e.g. `ItemBlueprint.IconMaterialRefId` -> 3. */
  references: Record<string, number>;
  totalReferences: number;
  /** The icon shown for this material (override first); set on the missing-icon and icon-override rows. */
  iconUrl?: string | null;
}

/** A block ref row in the audit. */
export interface MinecraftCatalogAuditBlockDto {
  id: number;
  namespaceKey: string;
  blockStateString: string | null;
  materialRefId: number | null;
  stateKey: string | null;
}

/** An EnchantmentDefinition that uses an enchantment ref (KNG-250). */
export interface MinecraftCatalogAuditEnchantmentDefinitionDto {
  id: number;
  key: string;
  displayName: string;
}

/** An enchantment ref in the audit, with the definitions that use it (KNG-250). */
export interface MinecraftCatalogAuditEnchantmentDto {
  id: number;
  namespaceKey: string;
  displayName: string | null;
  isCustom: boolean;
  catalogStatus: string;
  definitions: MinecraftCatalogAuditEnchantmentDefinitionDto[];
}

/** Read-only report of what blocks the phase 4 constraints and what needs a merge (§8 step 3). */
export interface MinecraftCatalogAuditDto {
  readyForConstraints: boolean;
  materialCount: number;
  unverifiedCount: number;
  /** Groups of material rows whose keys normalise to the same key: merge each group into one row. */
  materialKeyCollisions: MinecraftCatalogAuditMaterialDto[][];
  invalidMaterialKeys: MinecraftCatalogAuditMaterialDto[];
  notNormalizedMaterialKeys: MinecraftCatalogAuditMaterialDto[];
  /** Active materials the scan found no icon for and that have no override. */
  missingIcons?: MinecraftCatalogAuditMaterialDto[];
  /** Materials with a manual icon override; `iconUrl` is the override (phase 4). */
  iconOverrides?: MinecraftCatalogAuditMaterialDto[];
  /** Materials not in the latest scan that something still references (D3/D7). */
  missingButReferenced: MinecraftCatalogAuditMaterialDto[];
  blockRefCount: number;
  duplicateBlockStates: MinecraftCatalogAuditBlockDto[][];
  invalidBlockStates: MinecraftCatalogAuditBlockDto[];
  unlinkedBlockRefs: MinecraftCatalogAuditBlockDto[];
  notCanonicalBlockRefs: MinecraftCatalogAuditBlockDto[];
  /** KNG-250 (§12.5): enchantment refs, and those no scan has seen yet. */
  enchantmentCount: number;
  unverifiedEnchantmentCount: number;
  /** Enchantments not in the latest scan that an EnchantmentDefinition still uses. */
  missingEnchantmentsReferenced: MinecraftCatalogAuditEnchantmentDto[];
}

/** What the backfill changed (§8 step 2). A second run reports zeros. */
export interface MinecraftCatalogBackfillResultDto {
  materialKeysNormalized: number;
  materialDisplayNamesFilled: number;
  materialsCreated: number;
  blockRefsCanonicalized: number;
  blockRefsLinked: number;
  /** Rows the backfill left alone, with the reason. */
  skipped: string[];
}

/** Result of merging one material into another: rows repointed per referrer. */
export interface MinecraftMaterialMergeResultDto {
  sourceId: number;
  targetId: number;
  repointed: Record<string, number>;
}

/** Body of `PUT materials/{id}/icon-override`; null clears the override. */
export interface MinecraftIconOverrideDto {
  iconUrlOverride: string | null;
}
