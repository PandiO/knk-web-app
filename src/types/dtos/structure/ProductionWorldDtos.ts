import { StructureDto, StructureListDto } from './StructureDto';

// P2 world (PandiO/knk-workspace#91 API, #676 web app; production DESIGN § 3.3-3.4): warehouses and production
// structures, mirroring knk-web-api `Dtos/ProductionWorldDtos.cs` and `Enums/ProductionWorldEnums.cs`. Both carry every
// structure field, including the placement (in a district or rural). On create/update a null field means "keep"
// (create: the default).

/** Where a production structure sends its output (DESIGN § 3.3, § 7.4). */
export type WarehousePreference = 'Nearest' | 'Preferred';
export const WAREHOUSE_PREFERENCES: readonly WarehousePreference[] = ['Nearest', 'Preferred'];

/** A production structure's link to its town's road network (DESIGN § 7.6, D5). */
export type RoadConnectionState = 'Unmeasured' | 'Connected' | 'Unconnected';
export const ROAD_CONNECTION_STATES: readonly RoadConnectionState[] = ['Unmeasured', 'Connected', 'Unconnected'];

/** A storage or warehouse row on a structure page (knk-web-api `StructureStorageNavDto`). */
export interface StructureStorageNavDto {
    id: number;
    name?: string | null;
    /** Storages only: the purpose ("Output", "Delivery", ...). */
    purpose?: string | null;
}

/** `api/Warehouses`. */
export interface WarehouseDto extends StructureDto {
    acceptsDeliveries?: boolean | null;
    priority?: number | null;
    /** The delivery storage, created with the warehouse. */
    defaultStorageId?: number | null;
    /** Read only: the storages the warehouse holds (Kind Domain). */
    storages?: StructureStorageNavDto[] | null;
}

/** `api/ProductionStructures`. */
export interface ProductionStructureDto extends StructureDto {
    /** The production kind (P3, `api/ProductionKinds`); a new structure gets the kind's default workers and storages. */
    productionKindId?: number | null;
    /** Read only (P3): `{ id, name }` of the kind. */
    productionKind?: { id: number; name: string } | null;
    level?: number | null;
    productionEnabled?: boolean | null;
    automaticTransport?: boolean | null;
    /** 0 clears it (planner default). */
    transportThreshold?: number | null;
    /** 0 clears it (planner default). */
    transportCapacity?: number | null;
    warehousePreference?: WarehousePreference | null;
    /** 0 clears it. */
    preferredWarehouseId?: number | null;
    preferredWarehouse?: StructureStorageNavDto | null;
    /** Read only here: set by the game server through `PUT api/ProductionStructures/{id}/road-connection`. */
    roadConnection?: RoadConnectionState | null;
    roadConnectionMeasuredAt?: string | null;
    workersTotal?: number | null;
    /** Read only (P3/P5 write it). */
    workersPresent?: number | null;
    /** Read only: dashboard warnings (no road connection, contested or outside territory). */
    warnings?: string[] | null;
    /** Read only: the storages the structure holds (Kind Domain). */
    storages?: StructureStorageNavDto[] | null;
}

/** `PUT api/ProductionStructures/{id}/road-connection` (the game server's lane measurement, P5b). */
export interface RoadConnectionUpdateDto {
    roadConnection: RoadConnectionState;
}

/** Search row of `api/Warehouses/search` and `api/ProductionStructures/search` (knk-web-api `ProductionWorldListDto`). */
export interface ProductionWorldListDto extends StructureListDto {
    acceptsDeliveries?: boolean | null;
    priority?: number | null;
    productionKindId?: number | null;
    level?: number | null;
    productionEnabled?: boolean | null;
    roadConnection?: RoadConnectionState | null;
}
