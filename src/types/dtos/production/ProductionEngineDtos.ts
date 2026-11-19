// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app; PRODUCTION_KINDS.md § 2-5), mirroring knk-web-api
// `Dtos/ProductionEngineDtos.cs` and `Enums/ProductionEngineEnums.cs`. Enums travel as their names. On create and update
// a null field means "keep" (create: the default); child lists (a level's items, a line's inputs, a zone's odds and
// towns, a weather type's effects) replace the stored list when sent and are kept when null.

/** Where a production kind's resources come from (PRODUCTION_KINDS § 3.1). */
export type ProductionAreaModel = 'BorderedField' | 'ExclusiveVolume' | 'SharedRadius' | 'Pasture' | 'HuntingGround';

/** What weather and later modifiers target (PRODUCTION_KINDS § 2). */
export type ResourceCategory = 'Crops' | 'Wood' | 'Stone' | 'Ore' | 'Fish' | 'Flowers' | 'Animals';
export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = ['Crops', 'Wood', 'Stone', 'Ore', 'Fish', 'Flowers', 'Animals'];

/** Where a line's base rate comes from; the API accepts only `Configured` in P3. */
export type ProductionRateSource = 'Configured' | 'Derived' | 'Hybrid';

export type ProductionLineStatus = 'Running' | 'Paused' | 'BlockedFull' | 'BlockedInputs' | 'Error';

export type ProductionModifierScope = 'Global' | 'Kingdom' | 'Town' | 'Territory' | 'MapArea' | 'Structure' | 'Output';
export type ProductionModifierTarget = 'Any' | 'Blueprint' | 'Category' | 'Kind';
export type ProductionModifierEffect = 'Add' | 'Multiply';
export const MODIFIER_EFFECTS: readonly ProductionModifierEffect[] = ['Add', 'Multiply'];

/** A level item: an output unlocked from this level on, or part of the cost of upgrading to it. */
export type ProductionKindLevelItemRole = 'Unlock' | 'UpgradeCost';
export const LEVEL_ITEM_ROLES: readonly ProductionKindLevelItemRole[] = ['Unlock', 'UpgradeCost'];

/** A related row's id and name. */
export interface NamedRefDto {
    id: number;
    name: string;
}

export interface ProductionKindLevelItemDto {
    id?: number;
    role: ProductionKindLevelItemRole | string;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    itemBlueprint?: NamedRefDto | null;
    /** Units of an upgrade cost; 0 for an unlock. */
    amount: number;
}

/** `api/ProductionKindLevels` (GET, PUT, search; every kind has levels 1-10). */
export interface ProductionKindLevelDto {
    id: number;
    productionKindId: number;
    productionKind?: NamedRefDto | null;
    level: number;
    yieldMultiplier?: number | null;
    cycleSpeedMultiplier?: number | null;
    /** 0 clears it (no cap). */
    maxAreaSize?: number | null;
    outputMaxUnits?: number | null;
    unitsPerSlot?: number | null;
    transportCapacity?: number | null;
    /** Stored, without effect in V1. */
    upkeepReduction?: number | null;
    upgradeCoins?: number | null;
    upgradeDurationMinutes?: number | null;
    items?: ProductionKindLevelItemDto[] | null;
}

/** `api/ProductionKinds`; a kind comes with its ten levels. */
export interface ProductionKindDto {
    id: number;
    name?: string | null;
    description?: string | null;
    icon?: string | null;
    areaModel?: ProductionAreaModel | string | null;
    exclusiveAreas?: boolean | null;
    allowsDerived?: boolean | null;
    allowsConfigured?: boolean | null;
    allowsHybrid?: boolean | null;
    resourceCategory?: ResourceCategory | string | null;
    defaultWorkers?: number | null;
    cycleVariation?: boolean | null;
    defaultStoragesJson?: string | null;
    isActive?: boolean | null;
    createdAt?: string;
    /** Read only. */
    levels?: ProductionKindLevelDto[] | null;
}

export interface ProductionKindListDto {
    id: number;
    name: string;
    areaModel: string;
    resourceCategory: string;
    defaultWorkers: number;
    isActive: boolean;
    structureCount: number;
}

export interface ProductionKindLevelListDto {
    id: number;
    name: string;
    productionKindId: number;
    productionKindName: string;
    level: number;
    yieldMultiplier: number;
    cycleSpeedMultiplier: number;
    upgradeCoins: number;
}

export interface ProductionLineInputDto {
    id?: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    itemBlueprint?: NamedRefDto | null;
    amountPerHour: number;
    /** Read only. */
    accrued?: number;
}

/** `api/ProductionLines`; status, accrual and due times are read only. */
export interface ProductionLineDto {
    id: number;
    productionStructureId?: number | null;
    productionStructure?: NamedRefDto | null;
    itemBlueprintId?: number | null;
    itemBlueprint?: { id: number; name?: string | null } | null;
    rateSource?: ProductionRateSource | string | null;
    configuredRatePerHour?: number | null;
    /** Overrides the kind's category; "" clears it. */
    resourceCategory?: ResourceCategory | string | null;
    enabled?: boolean | null;
    status?: ProductionLineStatus | string | null;
    statusReason?: string | null;
    accrued?: number;
    anchorAt?: string;
    lastSettledAt?: string;
    nextSettleAt?: string;
    createdAt?: string;
    inputs?: ProductionLineInputDto[] | null;
}

export interface ProductionLineListDto {
    id: number;
    name: string;
    productionStructureId: number;
    productionStructureName: string;
    itemBlueprintId: number;
    itemBlueprintName: string;
    rateSource: string;
    configuredRatePerHour: number;
    status: string;
    nextSettleAt: string;
}

/** `POST api/ProductionLines/{id}/settle`. */
export interface ProductionSettleResultDto {
    settled: boolean;
    cycle?: ProductionCycleRecordDto | null;
}

/** `api/ProductionModifiers`. */
export interface ProductionModifierDto {
    id: number;
    name?: string | null;
    /** Read only: staff rows are "Admin". */
    source?: string | null;
    scope?: ProductionModifierScope | string | null;
    scopeRefId?: number | null;
    target?: ProductionModifierTarget | string | null;
    targetItemBlueprintId?: number | null;
    targetCategory?: string | null;
    targetProductionKindId?: number | null;
    effect?: ProductionModifierEffect | string | null;
    value?: number | null;
    activeFrom?: string | null;
    activeUntil?: string | null;
    clearWindow?: boolean | null;
    enabled?: boolean | null;
    createdAt?: string;
}

export interface ProductionModifierListDto {
    id: number;
    name: string;
    source: string;
    scope: string;
    scopeRefId?: number | null;
    target: string;
    effect: string;
    value: number;
    activeFrom?: string | null;
    activeUntil?: string | null;
    enabled: boolean;
}

export interface ClimateZoneWeatherDto {
    id?: number;
    weatherTypeId: number;
    weatherTypeName?: string | null;
    weatherType?: NamedRefDto | null;
    chancePercent: number;
}

export interface ClimateZoneTownDto {
    townId: number;
    townName?: string | null;
    town?: NamedRefDto | null;
}

export interface WeatherRollDto {
    id: number;
    climateZoneId: number;
    climateZoneName?: string | null;
    day: number;
    dayStartsAt: string;
    dayEndsAt: string;
    weatherTypeId?: number | null;
    /** "Clear" when no weather type was rolled. */
    weatherTypeName: string;
    weatherType?: NamedRefDto | null;
    rollValue: number;
    rolledAt: string;
}

/** `api/ClimateZones`. */
export interface ClimateZoneDto {
    id: number;
    name?: string | null;
    description?: string | null;
    /** Setting true makes this the default zone; a default zone can't be unset directly. */
    isDefault?: boolean | null;
    createdAt?: string;
    /** Their sum is at most 100 (the rest is clear). */
    weatherOdds?: ClimateZoneWeatherDto[] | null;
    /** A town moves here from its previous zone. */
    towns?: ClimateZoneTownDto[] | null;
    /** Read only: the latest stored rolls, newest first. */
    rolls?: WeatherRollDto[] | null;
}

export interface ClimateZoneListDto {
    id: number;
    name: string;
    isDefault: boolean;
    townCount: number;
    weatherTypeCount: number;
}

export interface WeatherTypeEffectDto {
    id?: number;
    category: ResourceCategory | string;
    effect: ProductionModifierEffect | string;
    value: number;
}

/** `api/WeatherTypes`. */
export interface WeatherTypeDto {
    id: number;
    name?: string | null;
    description?: string | null;
    createdAt?: string;
    effects?: WeatherTypeEffectDto[] | null;
}

export interface WeatherTypeListDto {
    id: number;
    name: string;
    effectCount: number;
}

/** One applied modifier in a cycle trace, in the order applied. */
export interface AppliedModifierDto {
    /** Level, Weather or Admin (later sources add more). */
    source: string;
    name: string;
    scope: string;
    effect: ProductionModifierEffect | string;
    value: number;
    modifierId?: number | null;
}

export interface ConsumedInputDto {
    itemBlueprintId: number;
    consumed: number;
}

/** One settle of one line: `api/ProductionCycleRecords` (read only). */
export interface ProductionCycleRecordDto {
    id: number;
    productionLineId: number;
    productionStructureId: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    settledAt: string;
    periodStart: string;
    periodEnd: string;
    elapsedSeconds: number;
    skippedSeconds: number;
    rateSource: string;
    baseRatePerHour: number;
    modifiers: AppliedModifierDto[];
    unlockFactor: number;
    workersPresent: number;
    workersTotal: number;
    workerFactor: number;
    effectiveRatePerHour: number;
    accruedBefore: number;
    accruedAfter: number;
    emitted: number;
    accepted: number;
    inputs: ConsumedInputDto[];
    statusAfter: ProductionLineStatus | string;
    shortfallReason?: string | null;
    stockTransactionId?: number | null;
}

export interface ProductionLineOverviewDto {
    line: ProductionLineDto;
    baseRatePerHour: number;
    /** In applied order: additions, then multiplications. */
    modifiers: AppliedModifierDto[];
    unlockFactor: number;
    workerFactor: number;
    effectiveRatePerHour: number;
    /** Empty = producing at the rate shown. */
    notProducingReasons: string[];
}

/** `GET api/ProductionStructures/{id}/production` (settles first while the feature is on). */
export interface ProductionOverviewDto {
    productionStructureId: number;
    featureEnabled: boolean;
    productionEnabled: boolean;
    productionKind?: NamedRefDto | null;
    level: number;
    workersPresent: number;
    workersTotal: number;
    outputStorageId?: number | null;
    inputStorageId?: number | null;
    climateZone?: string | null;
    weatherToday?: string | null;
    /** Structure-wide reasons nothing is produced. */
    notProducingReasons: string[];
    lines: ProductionLineOverviewDto[];
    recentCycles: ProductionCycleRecordDto[];
}

/** `PUT api/ProductionStructures/{id}/workers`. */
export interface WorkersPresentUpdateDto {
    workersPresent: number;
}

/** `POST api/ProductionStructures/{id}/upgrade`. */
export interface ProductionUpgradeRequestDto {
    /** Null = the structure's Output storage. */
    payFromStorageId?: number | null;
    /** Required when the level costs coins. */
    payerUserId?: number | null;
    idempotencyKey?: string | null;
}

export interface ProductionUpgradeResultDto {
    productionStructureId: number;
    fromLevel: number;
    toLevel: number;
    coinsPaid: number;
    stockTransactionId?: number | null;
    currencyTransactionId?: string | null;
}

/** `POST api/Production/run-now`. */
export interface ProductionSweepResultDto {
    featureEnabled: boolean;
    ranAt: string;
    weatherRolled: number;
    linesSettled: number;
    unitsEmitted: number;
    unitsAccepted: number;
    linesFailed: number;
}

/** Game settings section `production.engine` (P3): the engine's timing. */
export interface ProductionEngineSettingsDto {
    baseCycleMinutes: number;
    catchUpCapHours: number;
    /** 20 = a vanilla Minecraft day. */
    weatherDayMinutes: number;
}
