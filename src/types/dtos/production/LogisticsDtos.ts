import type { NamedRefDto } from './ProductionEngineDtos';
import type { TransportLineRequestDto } from './TransportDtos';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS.md § 2-5): versioned policies with their
// rules, consumer replenishment settings, reservations, planner runs and plans, and the town, service area and consumer
// views. Mirrors knk-web-api `Dtos/LogisticsDtos.cs` and `Enums/LogisticsEnums.cs`; enums travel as their names.

export type LogisticsPolicyScope = 'Town' | 'Warehouse' | 'Template';
export const LOGISTICS_POLICY_SCOPES: readonly LogisticsPolicyScope[] = ['Town', 'Warehouse', 'Template'];

export type LogisticsTownSize = 'Village' | 'Town' | 'City';
export const LOGISTICS_TOWN_SIZES: readonly LogisticsTownSize[] = ['Village', 'Town', 'City'];

/** The V1 rule types (TOWN_LOGISTICS § 4); the Later types come with PandiO/knk-workspace#324. */
export type LogisticsRuleType = 'Reserve' | 'PriorityClass' | 'ServiceArea' | 'Replenishment';
export const LOGISTICS_RULE_TYPES: readonly LogisticsRuleType[] = ['Reserve', 'PriorityClass', 'ServiceArea', 'Replenishment'];

export type LogisticsRuleScope = 'Town' | 'Warehouse';
export type LogisticsTargetKind = 'Any' | 'Blueprint' | 'Category' | 'Tag';
export const LOGISTICS_TARGET_KINDS: readonly LogisticsTargetKind[] = ['Any', 'Blueprint', 'Category', 'Tag'];
export type LogisticsConsumerKind = 'Any' | 'Structure' | 'ProductionKind';
export const LOGISTICS_CONSUMER_KINDS: readonly LogisticsConsumerKind[] = ['Any', 'Structure', 'ProductionKind'];
export type LogisticsAreaKind = 'District' | 'Rural' | 'Structure';
export const LOGISTICS_AREA_KINDS: readonly LogisticsAreaKind[] = ['District', 'Rural', 'Structure'];

/** Under scarcity the higher class is served first (TOWN_LOGISTICS § 4). */
export type LogisticsPriorityClass = 'Critical' | 'High' | 'Normal' | 'Low';
export const LOGISTICS_PRIORITY_CLASSES: readonly LogisticsPriorityClass[] = ['Critical', 'High', 'Normal', 'Low'];

export type LogisticsAuthor = 'Admin' | 'ClanCouncil';
export type LogisticsReservationStatus = 'Open' | 'Collected' | 'Released' | 'Cancelled';
export const LOGISTICS_RESERVATION_STATUSES: readonly LogisticsReservationStatus[] = ['Open', 'Collected', 'Released', 'Cancelled'];
export type LogisticsRunTrigger = 'Scheduled' | 'Manual';

/** What the planner did with one consumer line (the plan explanation's headline). */
export type LogisticsPlanOutcome =
    | 'Reserved' | 'PartlyReserved' | 'NotNeeded' | 'AlreadyReserved' | 'NoStock' | 'HeldByReserve'
    | 'NoWarehouse' | 'NoWorker' | 'NoRoom' | 'NotConnected' | 'CarrierFull';

/** Where a plan's policy came from. */
export type LogisticsPolicySource = 'Town' | 'DefaultTemplate' | 'None';

/** Where a consumer line's min and max came from: its setting, a Replenishment rule, or the line inputs × hours. */
export type LogisticsSettingSource = 'Setting' | 'Rule' | 'Inputs' | 'ShopLevel';

/** Game settings section `production.logistics` (kept on a save that leaves it out). */
export interface ProductionLogisticsSettingsDto {
    plannerIntervalMinutes: number;
    reservationMinutes: number;
    consumptionWindowDays: number;
    defaultReorderHours: number;
    defaultTargetHours: number;
    runRetentionDays: number;
}

// ================= Policies and rules =================

export interface LogisticsRuleDto {
    id?: number | null;
    logisticsPolicyId?: number | null;
    sequence: number;
    type?: LogisticsRuleType | string | null;
    /** Town (default) or Warehouse (a local reserve or service area). */
    scope?: LogisticsRuleScope | string | null;
    warehouseId?: number | null;
    warehouse?: NamedRefDto | null;
    targetKind?: LogisticsTargetKind | string | null;
    itemBlueprintId?: number | null;
    itemBlueprint?: NamedRefDto | null;
    categoryId?: number | null;
    category?: NamedRefDto | null;
    tagId?: number | null;
    tag?: NamedRefDto | null;
    consumerKind?: LogisticsConsumerKind | string | null;
    structureId?: number | null;
    structure?: NamedRefDto | null;
    productionKindId?: number | null;
    productionKind?: NamedRefDto | null;
    areaKind?: LogisticsAreaKind | string | null;
    districtId?: number | null;
    district?: NamedRefDto | null;
    units?: number | null;
    daysOfCover?: number | null;
    reorderPoint?: number | null;
    targetLevel?: number | null;
    priorityClass?: LogisticsPriorityClass | string | null;
    activeFrom?: string | null;
    activeUntil?: string | null;
    author?: LogisticsAuthor | string | null;
    reason?: string | null;
    /** Read only: the rule in one line. */
    summary?: string | null;
}

export interface LogisticsRuleListDto {
    id: number;
    logisticsPolicyId: number;
    policyName?: string | null;
    policyVersion: number;
    policyIsCurrent: boolean;
    sequence: number;
    type: LogisticsRuleType | string;
    scope: LogisticsRuleScope | string;
    summary: string;
    reason?: string | null;
}

/** A version of a policy. `PUT` makes a new version (a new id); `PUT` on a superseded version is 409. */
export interface LogisticsPolicyDto {
    id?: number | null;
    name?: string | null;
    scope?: LogisticsPolicyScope | string | null;
    townId?: number | null;
    town?: NamedRefDto | null;
    warehouseId?: number | null;
    warehouse?: NamedRefDto | null;
    /** Templates: a `ResourceCategory` name (Crops, Wood, Stone, Ore, Fish, Flowers, Animals); empty = general. */
    specialization?: string | null;
    townSize?: LogisticsTownSize | string | null;
    isDefaultTemplate?: boolean | null;
    version: number;
    lineageId: number;
    isCurrent: boolean;
    basedOnPolicyId?: number | null;
    supersededByPolicyId?: number | null;
    supersededAt?: string | null;
    author?: LogisticsAuthor | string | null;
    reason?: string | null;
    createdAt: string;
    createdByUserId?: number | null;
    rules?: LogisticsRuleDto[] | null;
}

export interface LogisticsPolicyListDto {
    id: number;
    name: string;
    scope: LogisticsPolicyScope | string;
    townId?: number | null;
    townName?: string | null;
    warehouseId?: number | null;
    warehouseName?: string | null;
    specialization?: string | null;
    townSize?: LogisticsTownSize | string | null;
    isDefaultTemplate: boolean;
    version: number;
    lineageId: number;
    isCurrent: boolean;
    ruleCount: number;
    reason?: string | null;
    createdAt: string;
}

/** `PUT api/LogisticsPolicies/{id}`: the whole rule list and the reason of the new version (other fields keep). */
export interface LogisticsPolicyUpdateDto {
    name?: string | null;
    specialization?: string | null;
    townSize?: LogisticsTownSize | string | null;
    isDefaultTemplate?: boolean | null;
    reason?: string | null;
    rules: LogisticsRuleDto[];
}

export interface LogisticsApplyTemplateDto {
    townId: number;
    reason?: string | null;
}

// ================= Consumer replenishment =================

export interface ConsumerReplenishmentDto {
    id?: number | null;
    storageId?: number | null;
    storage?: NamedRefDto | null;
    /** Read only: the storage's structure. */
    structureId?: number | null;
    structure?: NamedRefDto | null;
    itemBlueprintId?: number | null;
    itemBlueprint?: NamedRefDto | null;
    reorderPoint?: number | null;
    targetLevel?: number | null;
    /** Null: the policy's PriorityClass rule, else Normal. */
    priorityClass?: LogisticsPriorityClass | string | null;
    enabled?: boolean | null;
    note?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ConsumerReplenishmentListDto {
    id: number;
    storageId: number;
    storageName?: string | null;
    structureId: number;
    structureName?: string | null;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    reorderPoint: number;
    targetLevel: number;
    priorityClass?: LogisticsPriorityClass | string | null;
    enabled: boolean;
    updatedAt: string;
}

// ================= Reservations =================

export interface LogisticsReservationDto {
    id: number;
    townId: number;
    town?: NamedRefDto | null;
    warehouseId: number;
    warehouse?: NamedRefDto | null;
    warehouseStorageId: number;
    warehouseStorage?: NamedRefDto | null;
    consumerStructureId: number;
    consumerStructure?: NamedRefDto | null;
    consumerStorageId: number;
    consumerStorage?: NamedRefDto | null;
    itemBlueprintId: number;
    itemBlueprint?: NamedRefDto | null;
    amount: number;
    collected: number;
    status: LogisticsReservationStatus | string;
    priorityClass: LogisticsPriorityClass | string;
    transportOrderId?: number | null;
    transportOrderStatus?: string | null;
    plannerRunId?: number | null;
    createdAt: string;
    expiresAt: string;
    closedAt?: string | null;
    explanation?: string | null;
    statusReason?: string | null;
}

export interface LogisticsReservationListDto {
    id: number;
    townId: number;
    townName?: string | null;
    warehouseId: number;
    warehouseName?: string | null;
    consumerStructureId: number;
    consumerStructureName?: string | null;
    consumerStorageId: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    amount: number;
    collected: number;
    status: LogisticsReservationStatus | string;
    priorityClass: LogisticsPriorityClass | string;
    transportOrderId?: number | null;
    createdAt: string;
    expiresAt: string;
}

export interface LogisticsReleaseDto {
    reason?: string | null;
}

// ================= Planner runs and plans =================

/** The explanation of one consumer line ("why did or didn't the bakery get flour"). */
export interface LogisticsPlanEntryDto {
    consumerStructureId: number;
    consumerStructureName?: string | null;
    consumerStorageId: number;
    consumerStorageName?: string | null;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    warehouseId?: number | null;
    warehouseName?: string | null;
    priorityClass: LogisticsPriorityClass | string;
    /** Stock including what is on the way. */
    stock: number;
    reorderPoint: number;
    targetLevel: number;
    shortfall: number;
    reserved: number;
    outcome: LogisticsPlanOutcome | string;
    settingSource?: LogisticsSettingSource | string | null;
    ruleIds: number[];
    reservationId?: number | null;
    transportOrderId?: number | null;
    explanation: string;
}

export interface LogisticsPlannedOrderDto {
    consumerStructureId: number;
    consumerStructureName?: string | null;
    consumerStorageId: number;
    warehouseId: number;
    warehouseName?: string | null;
    warehouseStorageId: number;
    lines: TransportLineRequestDto[];
    carrierCapacity: number;
    workersPresent: number;
    workersTotal: number;
    transportOrderId?: number | null;
    warnings: string[];
}

export interface LogisticsReleasedDto {
    reservationId: number;
    status: LogisticsReservationStatus | string;
    reason: string;
}

/** `POST api/Logistics/towns/{id}/dry-run` (writes nothing) and `.../run-now` (with `runId`). */
export interface LogisticsPlanDto {
    townId: number;
    townName?: string | null;
    featureEnabled: boolean;
    dryRun: boolean;
    at: string;
    runId?: number | null;
    policyId?: number | null;
    policyName?: string | null;
    policyVersion?: number | null;
    policySource: LogisticsPolicySource | string;
    entries: LogisticsPlanEntryDto[];
    orders: LogisticsPlannedOrderDto[];
    released: LogisticsReleasedDto[];
    collected: number[];
    warnings: string[];
    summary: string;
}

export interface LogisticsPlannerRunDto {
    id: number;
    townId: number;
    town?: NamedRefDto | null;
    logisticsPolicyId?: number | null;
    policyVersion?: number | null;
    trigger: LogisticsRunTrigger | string;
    startedAt: string;
    finishedAt?: string | null;
    demandLines: number;
    reservationsCreated: number;
    ordersCreated: number;
    reservationsReleased: number;
    reservationsCollected: number;
    shortfalls: number;
    summary?: string | null;
    createdByUserId?: number | null;
    /** Lines at or above their min are not stored. */
    entries: LogisticsPlanEntryDto[];
}

export interface LogisticsPlannerRunListDto {
    id: number;
    townId: number;
    townName?: string | null;
    trigger: LogisticsRunTrigger | string;
    startedAt: string;
    policyVersion?: number | null;
    demandLines: number;
    reservationsCreated: number;
    ordersCreated: number;
    reservationsReleased: number;
    shortfalls: number;
    summary?: string | null;
}

// ================= Town views =================

export interface TownSupplyWarehouseLineDto {
    warehouseId: number;
    warehouseName?: string | null;
    stock: number;
    reserved: number;
    reserveUnits: number;
    available: number;
}

export interface TownSupplyLineDto {
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    stock: number;
    /** Held by open reservations. */
    reserved: number;
    /** Held back by Reserve rules (saving rules). */
    reserveUnits: number;
    available: number;
    inflowPerDay: number;
    outflowPerDay: number;
    /** Null without outflow. */
    daysOfCover?: number | null;
    warehouses: TownSupplyWarehouseLineDto[];
}

/** `GET api/Logistics/towns/{id}/supply`. */
export interface TownSupplyDto {
    townId: number;
    townName?: string | null;
    featureEnabled: boolean;
    at: string;
    consumptionWindowDays: number;
    warehouses: NamedRefDto[];
    lines: TownSupplyLineDto[];
    openReservations: LogisticsReservationListDto[];
    policyId?: number | null;
    policySource: LogisticsPolicySource | string;
    lastRun?: LogisticsPlannerRunListDto | null;
    /** Null while production is off. */
    nextRunAt?: string | null;
}

export interface ServiceAreaEntryDto {
    areaKind: LogisticsAreaKind | string;
    districtId?: number | null;
    districtName?: string | null;
    structureId?: number | null;
    structureName?: string | null;
    warehouseId?: number | null;
    warehouseName?: string | null;
    /** Rule (a ServiceArea rule) or Nearest (by road). */
    source: 'Rule' | 'Nearest' | string;
    ruleId?: number | null;
}

/** `GET api/Logistics/towns/{id}/service-areas`. */
export interface TownServiceAreasDto {
    townId: number;
    entries: ServiceAreaEntryDto[];
}

export interface ConsumerDemandLineDto {
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    stock: number;
    inbound: number;
    reorderPoint: number;
    targetLevel: number;
    priorityClass: LogisticsPriorityClass | string;
    settingSource: LogisticsSettingSource | string;
    consumerReplenishmentId?: number | null;
    ruleIds: number[];
}

export interface ConsumerStorageViewDto {
    storageId: number;
    storageName?: string | null;
    purpose: string;
    lines: ConsumerDemandLineDto[];
}

/** `GET api/Logistics/consumers/{structureId}` (404 for a structure that doesn't exist). */
export interface ConsumerViewDto {
    structureId: number;
    structureName?: string | null;
    townId?: number | null;
    /** Has an Input or Merchandise storage. */
    isConsumer: boolean;
    hasWorkers: boolean;
    workersTotal: number;
    workersPresent: number;
    carrierCapacity: number;
    serviceWarehouseId?: number | null;
    serviceWarehouseName?: string | null;
    serviceSource?: string | null;
    storages: ConsumerStorageViewDto[];
    openReservations: LogisticsReservationListDto[];
    warnings: string[];
}
