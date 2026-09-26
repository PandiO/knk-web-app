// Mirrors knk-web-api's Dtos/LootboxDtos.cs, Dtos/LootboxRuntimeDtos.cs and Dtos/ItemInstanceDtos.cs
// (docs/specs/lootboxes/DESIGN.md §3.2-§3.3). Every time is UTC (ISO string).

/** The in-house node every lootbox admin endpoint and the /admin/lootboxes page require. */
export const LOOTBOX_ADMIN_NODE = 'knk.admin.lootbox.manage';

/** Boxes are ★1-5 only (DESIGN.md Q3/D5). */
export const MAX_BOX_STARS = 5;

export interface NavRefDto {
    id: number;
    name?: string | null;
}

export interface GradeNavDto {
    id: number;
    name?: string | null;
    stars: number;
}

// ===== Configuration (FormWizard entities + the singleton) =====

export interface LootboxTypeGradeWeightDto {
    gradeId: number;
    grade?: GradeNavDto | null;
    weight: number;
}

export interface LootboxPoolEntryDto {
    itemBlueprintId: number;
    itemBlueprint?: NavRefDto | null;
    mode: 'Include' | 'Exclude';
    weightOverride?: number | null;
    gradeIdOverride?: number | null;
    gradeOverride?: GradeNavDto | null;
}

export interface LootboxEnchantRollDto {
    id?: number;
    enchantmentDefinitionId: number;
    enchantmentKey?: string | null;
    chancePercent: number;
    minLevel: number;
    maxLevel: number;
    minBoxStars: number;
    sortOrder: number;
}

export interface LootboxTypeDto {
    id?: number;
    name: string;
    categoryId: number;
    category?: NavRefDto | null;
    includeSubcategories: boolean;
    enabled: boolean;
    spawnWeight: number;
    minBoxStars: number;
    maxBoxStars: number;
    itemStarSpread: number;
    displayMaterialRefId?: number | null;
    displayMaterial?: (NavRefDto & { namespaceKey?: string | null }) | null;
    /** Extra per-type daily limit; null = only the global one. */
    maxClaimsPerPlayerPerDay?: number | null;
    /** Null = the global AnnounceMinItemStars. */
    announceMinItemStars?: number | null;
    gradeWeights: LootboxTypeGradeWeightDto[];
    poolEntries: LootboxPoolEntryDto[];
    enchantRolls: LootboxEnchantRollDto[];
}

export interface LootboxSpecialEntryDto {
    id?: number;
    /** Null = any lootbox type. */
    lootboxTypeId?: number | null;
    lootboxType?: NavRefDto | null;
    itemBlueprintId: number;
    itemBlueprint?: NavRefDto | null;
    chancePerMillion: number;
    minBoxStars: number;
    enabled: boolean;
    sortOrder: number;
}

export interface LootboxSpawnAreaTypeDto {
    lootboxTypeId: number;
    lootboxType?: NavRefDto | null;
}

export interface LootboxSpawnAreaDto {
    id?: number;
    name: string;
    world: string;
    wgRegionId: string;
    enabled: boolean;
    maxActive: number;
    spawnIntervalSeconds: number;
    spawnChancePercent: number;
    minOnlinePlayers: number;
    minDistanceFromPlayers: number;
    lifetimeMinutes: number;
    /** Comma-separated WorldGuard region ids. */
    excludedRegionIds?: string | null;
    /** Set by the in-game /knk lootbox area create. */
    createdByUserId?: number | null;
    /** Empty = every enabled type. */
    allowedTypes: LootboxSpawnAreaTypeDto[];
}

export interface LootboxConfigurationDto {
    enabled: boolean;
    globalMaxActive: number;
    /** Per player per UTC calendar day, all types together; null = no cap. */
    maxClaimsPerPlayerPerDay?: number | null;
    announceMinItemStars: number;
    announceSpawnMinBoxStars: number;
    dropAnnouncementTemplate: string;
    spawnAnnouncementTemplate: string;
    updatedAt?: string;
}

/** PUT api/LootboxConfiguration replaces every value (omitted ones fall back to the API defaults). */
export type UpdateLootboxConfigurationDto = Omit<LootboxConfigurationDto, 'updatedAt'>;

// ===== Odds preview (GET api/LootboxTypes/{id}/odds?boxStars=) =====
// Every percentage is 0-100. Grade percentages are within the normal (non-special) roll; item and
// special percentages are of the whole box.

export interface LootboxGradeOddsDto {
    gradeId: number;
    name: string;
    stars: number;
    percent: number;
    /** Pool items of this grade (item grades only). */
    itemCount?: number | null;
}

export interface LootboxSpecialOddsDto {
    specialEntryId: number;
    itemBlueprintId: number;
    name: string;
    chancePerMillion: number;
    /** The entry's own chance. */
    chancePercent: number;
    /** Chance that this special is what the box gives (own chance × every earlier special missed). */
    percent: number;
}

export interface LootboxItemOddsDto {
    itemBlueprintId: number;
    name: string;
    gradeId: number;
    stars: number;
    weight: number;
    quantity: number;
    /** False for books and stackable items: no rolled enchantments. */
    rollsEnchantments: boolean;
    percentWithinGrade: number;
    percent: number;
}

export interface LootboxEnchantLevelRangeDto {
    gradeId: number;
    stars: number;
    /** Null = the roll is always dropped on this grade (cap below 1). */
    minLevel?: number | null;
    maxLevel?: number | null;
}

export interface LootboxEnchantOddsDto {
    enchantRollId: number;
    enchantmentDefinitionId: number;
    key: string;
    isCustom: boolean;
    /** Per enchantable item. */
    hitPercent: number;
    minLevel: number;
    maxLevel: number;
    applicableItemCount: number;
    /** Chance that a box of this grade gives an item carrying it from this roll. */
    landPercent: number;
    levelsByGrade: LootboxEnchantLevelRangeDto[];
}

export interface LootboxOddsDto {
    lootboxTypeId: number;
    lootboxTypeName: string;
    boxStars: number;
    boxGrades: LootboxGradeOddsDto[];
    specials: LootboxSpecialOddsDto[];
    normalRollPercent: number;
    /** No grade in [boxStars - spread, boxStars] had items; a nearer grade is used. */
    windowWidened: boolean;
    itemGrades: LootboxGradeOddsDto[];
    items: LootboxItemOddsDto[];
    enchantments: LootboxEnchantOddsDto[];
}

// ===== Runtime (active boxes, drop log) =====

export type LootboxSpawnStatus = 'Active' | 'Claimed' | 'Expired' | 'Removed';

export interface LootboxSpawnDto {
    id: number;
    token: string;
    lootboxTypeId: number;
    lootboxTypeName: string;
    categoryName?: string | null;
    boxGradeId: number;
    boxGradeName: string;
    boxStars: number;
    boxLabel: string;
    spawnAreaId?: number | null;
    spawnAreaName?: string | null;
    world: string;
    x: number;
    y: number;
    z: number;
    status: LootboxSpawnStatus | string;
    spawnedAt: string;
    expiresAt: string;
    claimedAt?: string | null;
    claimedByUserId?: number | null;
    serverId?: string | null;
    createdByUserId?: number | null;
}

/** One drop-log row (POST api/LootboxClaims/search). */
export interface LootboxClaimLogDto {
    id: number;
    lootboxSpawnId?: number | null;
    /** Neither a world box nor a token item: a staff give. */
    isAdminGive: boolean;
    /** Set when a lootbox token item was opened (Phase 5). */
    lootboxTokenId?: number | null;
    /** World | Token | AdminGive (older API builds leave it out). */
    source?: LootboxClaimSource | null;
    userId: number;
    username?: string | null;
    lootboxTypeId: number;
    lootboxTypeName?: string | null;
    boxGradeId: number;
    boxStars?: number | null;
    itemBlueprintId: number;
    itemName?: string | null;
    itemGradeId?: number | null;
    itemStars?: number | null;
    quantity: number;
    isSpecial: boolean;
    /** Null for stackable items. */
    itemInstanceId?: number | null;
    claimedAt: string;
    deliveredAt?: string | null;
    deliveryMethod?: string | null;
    deliveryNote?: string | null;
}

export type LootboxClaimSource = 'World' | 'Token' | 'AdminGive';

/** Filters POST api/LootboxClaims/search understands (all optional, sent as strings). */
export interface LootboxClaimSearchFilters {
    userId?: string;
    lootboxTypeId?: string;
    itemGradeId?: string;
    boxGradeId?: string;
    isSpecial?: 'true' | 'false';
    delivered?: 'true' | 'false';
    adminGive?: 'true' | 'false';
    source?: LootboxClaimSource;
    /** ISO date-time, inclusive. */
    from?: string;
    /** ISO date-time, exclusive. */
    to?: string;
}

/** The API's own paged shape (pageNumber, no totalPages). */
export interface LootboxPagedResultDto<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
}

// ===== ItemInstance (GET api/ItemInstances/{id}) =====

export interface ItemInstanceEnchantmentDto {
    enchantmentDefinitionId: number;
    key: string;
    displayName: string;
    isCustom: boolean;
    level: number;
}

export interface ItemInstanceDto {
    id: number;
    itemBlueprintId: number;
    itemBlueprint?: NavRefDto | null;
    gradeId?: number | null;
    grade?: GradeNavDto | null;
    ownerUserId?: number | null;
    ownerUsername?: string | null;
    origin: string;
    originRef?: string | null;
    createdAt: string;
    ownerCount: number;
    customDisplayName?: string | null;
    isSoulbound: boolean;
    isGhosted: boolean;
    enchantments: ItemInstanceEnchantmentDto[];
}

// ===== Lootbox token items (IMPLEMENTATION_PLAN.md Phase 5) =====

export type LootboxTokenStatus = 'Issued' | 'Redeemed' | 'Revoked';
export type LootboxTokenReason = 'Admin' | 'PremiumTier' | 'Kit' | 'PvpKill' | 'Referral' | 'Other';

/** One token item (POST api/LootboxTokens/search). The token id lives in the item's knk_lootbox_token tag. */
export interface LootboxTokenDto {
    id: number;
    token: string;
    lootboxTypeId: number;
    lootboxTypeName: string;
    categoryName?: string | null;
    boxGradeId: number;
    boxStars: number;
    boxLabel: string;
    status: LootboxTokenStatus;
    reason: LootboxTokenReason;
    note?: string | null;
    issuedToUserId?: number | null;
    issuedToUsername?: string | null;
    issuedByUserId?: number | null;
    issuedAt: string;
    deliveredAt?: string | null;
    redeemedAt?: string | null;
    redeemedByUserId?: number | null;
    redeemedByUsername?: string | null;
    revokedAt?: string | null;
    /** The drop-log row the token was opened into. */
    claimId?: number | null;
}

/** Filters POST api/LootboxTokens/search understands (all optional, sent as strings). */
export interface LootboxTokenSearchFilters {
    userId?: string;
    lootboxTypeId?: string;
    status?: LootboxTokenStatus;
    reason?: LootboxTokenReason;
    delivered?: 'true' | 'false';
}

/** A grant rule (api/LootboxTokenGrants): a premium tier or a kit issues token items. Exactly one of the two is set. */
export interface LootboxTokenGrantDto {
    id?: number;
    lootboxTypeId: number;
    lootboxTypeName?: string | null;
    /** 1-5; null = rolled per token from the type's box-grade weights. */
    boxStars?: number | null;
    quantity: number;
    permissionGroupId?: number | null;
    permissionGroupName?: string | null;
    kitId?: number | null;
    kitName?: string | null;
    enabled: boolean;
}
