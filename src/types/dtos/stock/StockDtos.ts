// Stock core P1 (PandiO/knk-workspace#97 API, #675 web app; production DESIGN § 4). Mirrors knk-web-api
// `Dtos/StockDtos.cs` and `Enums/StockEnums.cs`; the API sends enums as strings.

/** The node every stock write needs (move, adjust, reverse, roll-up); not under knk.admin, so knk.admin.* lacks it. */
export const ECONOMY_ADMIN_NODE = 'knk.economy.admin';
/** Storages are a World-area dashboard type: their writes need knk.admin.world (delete also knk.admin.delete). */
export const STORAGE_WRITE_NODE = 'knk.admin.world';
/** The ledger's reads: the World area node or the economy node (dashboard type StockTransaction). */
export const STOCK_LEDGER_READ_NODES: readonly string[] = [STORAGE_WRITE_NODE, ECONOMY_ADMIN_NODE];

export type StorageKind = 'Domain' | 'Player' | 'Clan' | 'Transit' | 'Virtual';
export type StoragePurpose = 'General' | 'Output' | 'Input' | 'Delivery' | 'Merchandise' | 'Inbox' | 'Stash' | 'Vault';
export type StockReason =
    | 'Production' | 'ProductionInput'
    | 'TransportLoad' | 'TransportDeliver' | 'TransportReturn' | 'TransportRobbed' | 'TransportLost'
    | 'Distribution' | 'Trade' | 'Deposit' | 'Withdraw'
    | 'RewardInbox' | 'InboxClaim' | 'InboxOverflow' | 'InboxExpired'
    | 'ContainerSync' | 'PlayerHarvest' | 'Spoilage' | 'AdminAdjust' | 'Correction';
export type StockMoveMode = 'AllOrNothing' | 'Partial';
export type StockRejectReason = 'None' | 'CapacityFull' | 'DistinctCapReached' | 'NotEnoughStock' | 'Locked' | 'OtherLineRejected';
export type StockResultStatus = 'Applied' | 'PartiallyApplied' | 'Rejected';
export type StockActorKind = 'User' | 'System' | 'PluginServer';

export const STOCK_REASONS: readonly StockReason[] = [
    'Production', 'ProductionInput',
    'TransportLoad', 'TransportDeliver', 'TransportReturn', 'TransportRobbed', 'TransportLost',
    'Distribution', 'Trade', 'Deposit', 'Withdraw',
    'RewardInbox', 'InboxClaim', 'InboxOverflow', 'InboxExpired',
    'ContainerSync', 'PlayerHarvest', 'Spoilage', 'AdminAdjust', 'Correction',
];

export interface StockNavDto {
    id: number;
    name?: string | null;
}

/** `GET api/Storages/{id}`: the storage with its lines, units and capacity use (detail reads only). */
export interface StorageDto {
    id?: number | null;
    name?: string | null;
    kind?: StorageKind | null;
    purpose?: StoragePurpose | null;
    domainId?: number | null;
    domain?: StockNavDto | null;
    userId?: number | null;
    user?: StockNavDto | null;
    clanId?: number | null;
    clan?: StockNavDto | null;
    systemKey?: string | null;
    /** The holder's name (domain, username, clan), the system key, or "Transit". */
    holderName?: string | null;
    maxUnits?: number | null;
    maxDistinct?: number | null;
    unitsPerSlot?: number | null;
    totalUnits?: number | null;
    distinctItems?: number | null;
    /** Σ amount × storage weight, in raw units (DESIGN § 4.4). */
    capacityUsed?: number | null;
    rowVersion?: number | null;
    lockedUntil?: string | null;
    lockReason?: string | null;
    isLocked?: boolean | null;
    createdAt?: string | null;
    lines?: StockLineDto[] | null;
    units?: StockUnitDto[] | null;
}

export interface StorageListDto {
    id: number;
    name: string;
    kind: StorageKind;
    purpose: StoragePurpose;
    holderName?: string | null;
    domainId?: number | null;
    userId?: number | null;
    clanId?: number | null;
    systemKey?: string | null;
    totalUnits: number;
    distinctItems: number;
    maxUnits?: number | null;
    maxDistinct?: number | null;
    lockedUntil?: string | null;
}

export interface StockLineDto {
    id: number;
    storageId: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    amount: number;
    storageWeight: number;
    updatedAt: string;
}

export interface StockUnitDto {
    id: number;
    storageId: number;
    itemInstanceId: number;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    customDisplayName?: string | null;
    addedAt: string;
}

export interface StockTransactionListDto {
    id: number;
    reason: StockReason;
    mode: StockMoveMode;
    actorKind: StockActorKind;
    actorUserId?: number | null;
    actorComponent?: string | null;
    sourceType?: string | null;
    sourceRef?: string | null;
    note?: string | null;
    reversesTransactionId?: number | null;
    createdAt: string;
    moveCount: number;
    totalAmount: number;
}

export interface StockTransactionDto extends StockTransactionListDto {
    actorUsername?: string | null;
    idempotencyKey?: string | null;
    /** The correction that undid this transaction, if any. */
    reversedByTransactionId?: number | null;
    moves: StockMoveDto[];
}

export interface StockMoveDto {
    id: number;
    transactionId: number;
    lineNo: number;
    fromStorageId: number;
    fromStorageName?: string | null;
    toStorageId: number;
    toStorageName?: string | null;
    itemBlueprintId?: number | null;
    itemBlueprintName?: string | null;
    itemInstanceId?: number | null;
    amount: number;
    reason: StockReason;
    createdAt: string;
}

/** A day's `Production` / `ProductionInput` moves of one line, rolled up after 30 days (G3, A22). */
export interface StockMoveRollupDto {
    id: number;
    day: string;
    reason: StockReason;
    fromStorageId: number;
    fromStorageName?: string | null;
    toStorageId: number;
    toStorageName?: string | null;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    amount: number;
    moveCount: number;
    rolledUpAt: string;
}

export interface StockLineRequestDto {
    fromStorageId: number;
    toStorageId: number;
    itemBlueprintId?: number | null;
    itemInstanceId?: number | null;
    /** Raw units; 1 for a unique item (may be left out then). */
    amount?: number | null;
}

/** `POST api/StockTransactions`: one transaction with one reason. */
export interface StockMoveRequestDto {
    reason: StockReason;
    mode: StockMoveMode;
    lines: StockLineRequestDto[];
    note?: string | null;
    sourceType?: string | null;
    sourceRef?: string | null;
    idempotencyKey?: string | null;
}

/** `POST api/StockTransactions/adjust`: + from SYS_ADJUSTMENT into the storage, − back out; the note is required. */
export interface StockAdjustRequestDto {
    storageId: number;
    itemBlueprintId?: number | null;
    itemInstanceId?: number | null;
    delta: number;
    note: string;
    idempotencyKey?: string | null;
}

export interface StockReverseRequestDto {
    note?: string | null;
    idempotencyKey?: string | null;
}

export interface StockLineResultDto {
    lineNo: number;
    fromStorageId: number;
    toStorageId: number;
    itemBlueprintId?: number | null;
    itemInstanceId?: number | null;
    requested: number;
    accepted: number;
    rejected: number;
    rejectReason: StockRejectReason;
}

/** A stock request's result: capacity, missing stock and locks come back as 200 with a status, never as errors. */
export interface StockResultDto {
    status: StockResultStatus;
    transactionId?: number | null;
    replayed: boolean;
    accepted: number;
    lines: StockLineResultDto[];
}

/** `GET api/StockTransactions/reconcile` (knk-web-api `StockReconciliationReport`). */
export interface StockReconciliationReportDto {
    checkedAt: string;
    clean: boolean;
    linesChecked: number;
    unitsChecked: number;
    blueprintImbalanceCount: number;
    lineDifferenceCount: number;
    unitDifferenceCount: number;
    totalDifferenceCount: number;
    blueprintImbalances: { itemBlueprintId: number; sum: number }[];
    lineDifferences: { storageId: number; itemBlueprintId: number; lineAmount: number; ledgerNet: number }[];
    unitDifferences: { itemInstanceId: number; storageId?: number | null; ledgerStorageId?: number | null }[];
    totalDifferences: {
        storageId: number;
        storedTotalUnits: number;
        actualTotalUnits: number;
        storedDistinctItems: number;
        actualDistinctItems: number;
    }[];
}

/** `POST api/StockTransactions/rollup` (knk-web-api `StockRollupResult`). */
export interface StockRollupResultDto {
    cutoff: string;
    transactionsRolledUp: number;
    movesRolledUp: number;
    rollupRowsWritten: number;
}

/** The API's own paged result (`PagedResultDto<T>`: `pageNumber`, no `totalPages`). */
export interface StockPagedResultDto<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
}

/** The API's paged query (`PagedQueryDto`); every filter value is a string. */
export interface StockPagedQueryDto {
    pageNumber: number;
    pageSize: number;
    searchTerm?: string | null;
    sortBy?: string | null;
    sortDescending?: boolean;
    filters?: Record<string, string>;
}
