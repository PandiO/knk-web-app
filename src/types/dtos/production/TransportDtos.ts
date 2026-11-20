// Transport core P5 (PandiO/knk-workspace#79 API, #682 web app; production DESIGN § 7), mirroring knk-web-api
// `Dtos/TransportDtos.cs` and `Enums/TransportEnums.cs`. Enums travel as their names; dates as ISO strings.

import type { NamedRefDto } from './ProductionEngineDtos';

/** Why a transport order exists (DESIGN § 7.1). */
export type TransportOrigin = 'Automatic' | 'Distribution' | 'Trade' | 'Manual' | 'Quest';
export const TRANSPORT_ORIGINS: readonly TransportOrigin[] = ['Automatic', 'Distribution', 'Trade', 'Manual', 'Quest'];

/** The lifecycle shared by every carrier (DESIGN § 7.2). V1 uses Planned to Cancelled; the rest is reserved. */
export type TransportStatus =
    | 'Planned' | 'Assigned' | 'Loading' | 'InTransit' | 'AtStop' | 'AwaitingSpace' | 'Returning' | 'ReturnBlocked'
    | 'Delivered' | 'Returned' | 'Cancelled' | 'Ambushed' | 'Defended' | 'Robbed' | 'Lost' | 'Stalled';
export const TRANSPORT_STATUSES: readonly TransportStatus[] = [
    'Planned', 'Assigned', 'Loading', 'InTransit', 'AtStop', 'AwaitingSpace', 'Returning', 'ReturnBlocked',
    'Delivered', 'Returned', 'Cancelled', 'Ambushed', 'Defended', 'Robbed', 'Lost', 'Stalled',
];

export type TransportCarrierMode = 'Simulated' | 'NpcCaravan' | 'PlayerCourier';
export type TransportStopStatus = 'Pending' | 'Delivered' | 'Partial' | 'Skipped';
export type TransportEventKind =
    | 'Created' | 'WaitingForWorker' | 'Assigned' | 'Loaded' | 'Departed' | 'ArrivedAtStop' | 'Delivered' | 'AwaitingSpace'
    | 'Rerouted' | 'ReturnStarted' | 'Returned' | 'ReturnBlocked' | 'WorkerReturned' | 'Completed' | 'CancelRequested'
    | 'Cancelled' | 'Note';
/** Who measured a lane (DESIGN § 7.6). */
export type TransportLaneSource = 'Plugin' | 'Manual';
/** Where a leg's distance came from. */
export type TransportDistanceSource = 'Lane' | 'Estimated' | 'Fallback' | 'TurnedAround';

/** `GET api/TransportOrders/{id}`: an order with its stops, cargo, carrier and event log. */
export interface TransportOrderDto {
    id: number;
    origin: TransportOrigin | string;
    status: TransportStatus | string;
    statusReason?: string | null;
    sourceStorageId: number;
    sourceStorage?: NamedRefDto | null;
    sourceStructureId?: number | null;
    sourceStructure?: NamedRefDto | null;
    cargoStorageId: number;
    cargoStorage?: NamedRefDto | null;
    carrierStructureId?: number | null;
    carrierStructure?: NamedRefDto | null;
    carrierCapacity?: number | null;
    risk?: number | null;
    currentStructureId?: number | null;
    currentStopId?: number | null;
    reroutes: number;
    cancelRequested: boolean;
    executeAfter: string;
    nextActionAt?: string | null;
    createdAt: string;
    departedAt?: string | null;
    legStartedAt?: string | null;
    etaAt?: string | null;
    waitingSince?: string | null;
    completedAt?: string | null;
    createdByUserId?: number | null;
    note?: string | null;
    clientKey?: string | null;
    isFinal: boolean;
    /** What the Transit storage holds now (the cargo on the road). */
    inTransit: TransportCargoDto[];
    stops: TransportStopDto[];
    lines: TransportOrderLineDto[];
    assignments: TransportAssignmentDto[];
    events: TransportEventDto[];
}

/** A row of `POST api/TransportOrders/search`. */
export interface TransportOrderListDto {
    id: number;
    origin: TransportOrigin | string;
    status: TransportStatus | string;
    statusReason?: string | null;
    sourceStorageId: number;
    sourceStorageName?: string | null;
    sourceStructureId?: number | null;
    sourceStructureName?: string | null;
    /** The stops' storage names in visiting order, joined with " → ". */
    destinations: string;
    unitsRequested: number;
    unitsLoaded: number;
    unitsDelivered: number;
    unitsReturned: number;
    createdAt: string;
    etaAt?: string | null;
    completedAt?: string | null;
}

export interface TransportCargoDto {
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    amount: number;
}

export interface TransportStopDto {
    id: number;
    sequence: number;
    storageId: number;
    storage?: NamedRefDto | null;
    structureId?: number | null;
    structure?: NamedRefDto | null;
    status: TransportStopStatus | string;
    reroutedFromStopId?: number | null;
    distanceBlocks?: number | null;
    distanceSource?: TransportDistanceSource | string | null;
    etaAt?: string | null;
    arrivedAt?: string | null;
    completedAt?: string | null;
    attempts: number;
    lines: TransportStopLineDto[];
}

export interface TransportStopLineDto {
    id: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    itemBlueprint?: NamedRefDto | null;
    planned: number;
    delivered: number;
}

export interface TransportOrderLineDto {
    id: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    itemBlueprint?: NamedRefDto | null;
    requested: number;
    loaded: number;
    delivered: number;
    returned: number;
    lost: number;
}

export interface TransportAssignmentDto {
    id: number;
    mode: TransportCarrierMode | string;
    carrierStructureId?: number | null;
    carrierStructure?: NamedRefDto | null;
    workers: number;
    speedBlocksPerSecond: number;
    capacity?: number | null;
    assignedAt: string;
    releasedAt?: string | null;
}

export interface TransportEventDto {
    id: number;
    at: string;
    kind: TransportEventKind | string;
    statusAfter: TransportStatus | string;
    transportStopId?: number | null;
    stockTransactionId?: number | null;
    message: string;
}

/** `POST api/TransportOrders` (a manual or quest order) and `POST api/TransportOrders/dry-run` (the same body). */
export interface TransportOrderCreateDto {
    sourceStorageId: number;
    /** Empty: the source storage's production structure carries (one of its workers), else a simulated carrier. */
    carrierStructureId?: number | null;
    origin?: 'Manual' | 'Quest' | null;
    executeAfter?: string | null;
    note?: string | null;
    /** A retry with the same key returns the order the first request made (no second order). */
    clientKey?: string | null;
    stops: TransportStopRequestDto[];
}

export interface TransportStopRequestDto {
    storageId: number;
    lines: TransportLineRequestDto[];
}

export interface TransportLineRequestDto {
    itemBlueprintId: number;
    amount: number;
}

export interface TransportCancelDto {
    reason?: string | null;
}

/** What an order would do, without writing anything (`POST api/TransportOrders/dry-run`). */
export interface TransportPlanDto {
    valid: boolean;
    /** Why the order can't be made. */
    errors: string[];
    /** It can be made, but: short stock, no free worker, an estimated route, no room at a stop, ... */
    warnings: string[];
    sourceStorageId: number;
    sourceStructureId?: number | null;
    carrierStructureId?: number | null;
    carrierCapacity?: number | null;
    speedBlocksPerSecond: number;
    workersPresent?: number | null;
    workersTotal?: number | null;
    lines: TransportPlanLineDto[];
    legs: TransportPlanLegDto[];
    totalUnits: number;
    totalSeconds: number;
}

export interface TransportPlanLineDto {
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    requested: number;
    /** What the source holds now (what loading would take, at most the request). */
    available: number;
}

export interface TransportPlanLegDto {
    sequence: number;
    fromStructureId?: number | null;
    toStructureId?: number | null;
    toStorageId: number;
    toStorageName?: string | null;
    distanceBlocks: number;
    distanceSource: TransportDistanceSource | string;
    seconds: number;
    lines: TransportLineRequestDto[];
    /** Raw units the stop's storage has room for now (null = uncapped). */
    roomUnits?: number | null;
}

/** `GET api/ProductionStructures/{id}/transport`: the automatic trigger's dry run, open orders and workers away. */
export interface TransportStructureViewDto {
    productionStructureId: number;
    featureEnabled: boolean;
    automaticTransport: boolean;
    roadConnection: string;
    isRural: boolean;
    effectiveTownId?: number | null;
    outputStorageId?: number | null;
    outputUnits: number;
    outputMaxUnits?: number | null;
    threshold: number;
    carrierCapacity: number;
    workersPresent: number;
    workersTotal: number;
    workersAway: number;
    /** No road connection (D5), a full Output storage, no warehouse, no workers. */
    warnings: string[];
    /** Why an automatic order would fire now. */
    triggerReasons: string[];
    /** Why no automatic order would be made now. */
    heldReasons: string[];
    /** The order the trigger would make now (null when held or not triggered). */
    wouldCreate?: TransportPlanDto | null;
    destinationWarehouseId?: number | null;
    openOrders: TransportOrderListDto[];
}

/** `POST api/TransportOrders/run-now`: one transport sweep (409 while production is off). */
export interface TransportSweepResultDto {
    featureEnabled: boolean;
    ranAt: string;
    ordersCreated: number;
    ordersAdvanced: number;
    ordersFailed: number;
}

/** A lane (`api/TransportLanes`, DESIGN § 7.6): the measured route between two structures. */
export interface TransportLaneDto {
    id?: number | null;
    fromStructureId?: number | null;
    fromStructure?: NamedRefDto | null;
    toStructureId?: number | null;
    toStructure?: NamedRefDto | null;
    reachable?: boolean | null;
    roadDistance?: number | null;
    straightDistance?: number | null;
    routeEdgeIds?: number[] | null;
    measuredSeconds?: number | null;
    source?: TransportLaneSource | string | null;
    measuredAt?: string | null;
    note?: string | null;
}

/** A row of `POST api/TransportLanes/search`. */
export interface TransportLaneListDto {
    id: number;
    fromStructureId: number;
    fromStructureName?: string | null;
    toStructureId: number;
    toStructureName?: string | null;
    reachable: boolean;
    roadDistance?: number | null;
    straightDistance?: number | null;
    source: TransportLaneSource | string;
    measuredAt: string;
}

/** Game settings section `production.transport` (knk-web-api `ProductionTransportSettingsDto`). */
export interface ProductionTransportSettingsDto {
    walkingSpeedBlocksPerSecond: number;
    defaultCarrierCapacity: number;
    defaultThresholdPercent: number;
    defaultThresholdUnits: number;
    unmeasuredRouteFactor: number;
    fallbackDistanceBlocks: number;
    awaitingSpaceMinutes: number;
    maxReroutes: number;
    laneMaxAgeHours: number;
}
