import type { ProductionEngineSettingsDto } from '../production/ProductionEngineDtos';
import type { ProductionTransportSettingsDto } from '../production/TransportDtos';

/**
 * Territory V1 (PandiO/knk-workspace#326 API, #690 web app; knk-workspace docs/specs/territory/DESIGN.md): the JSON
 * shapes of knk-web-api `Dtos/TerritoryDtos.cs`. Kingdoms, provinces and crown land are territory holders' records;
 * conflicts are written by the game server's report and resolved by admins.
 */

/** Range = (base range + power × factor) × capital multiplier for a capital district (G11). */
export interface TerritorySettingsDto {
    baseRange: number;
    powerFactor: number;
    capitalMultiplier: number;
}

/** Game settings section `production` (production DESIGN § 18.2, G16): the feature flag and the territory ranges. */
export interface ProductionSettingsDto {
    /** `Production:Enabled`: gates the feature's background work (for territory: the game server's report). */
    enabled: boolean;
    territory: TerritorySettingsDto;
    /** The production engine's timing (P3, PandiO/knk-workspace#86, #678). The API resets it to the defaults when a
     *  `PUT api/GameSettings` sends a `production` section without it, so the settings page always sends it back. */
    engine?: ProductionEngineSettingsDto;
    /** Transport (P5, PandiO/knk-workspace#79, #682). A save without it keeps the stored values; the settings page
     *  shows it and always sends it back. */
    transport?: ProductionTransportSettingsDto;
}

export type TerritoryHolderKind = 'Town' | 'Kingdom';

export interface TerritoryHolderDto {
    kind: TerritoryHolderKind | string;
    id: number;
    /** Read only: null when the holder was deleted. */
    name?: string | null;
}

/** Id and name of a related row. */
export interface TerritoryNavDto {
    id: number;
    name?: string | null;
}

// ----- Kingdom -----

export interface KingdomDto {
    id?: number | null;
    name: string;
    description?: string | null;
    createdAt?: string | null;
    /** Read only. */
    towns?: TerritoryNavDto[] | null;
    /** Read only. */
    provinces?: TerritoryNavDto[] | null;
    /** Read only. */
    crownLands?: TerritoryNavDto[] | null;
}

export interface KingdomListDto {
    id: number;
    name: string;
    description?: string | null;
    townCount: number;
    crownLandCount: number;
}

// ----- Province -----

export interface ProvinceDto {
    id?: number | null;
    name: string;
    description?: string | null;
    kingdomId: number;
    createdAt?: string | null;
    /** Read only. */
    kingdom?: TerritoryNavDto | null;
    /** Read only. */
    towns?: TerritoryNavDto[] | null;
}

export interface ProvinceListDto {
    id: number;
    name: string;
    kingdomId: number;
    kingdomName?: string | null;
    townCount: number;
}

// ----- Crown land -----

export interface CrownLandDto {
    id?: number | null;
    name: string;
    description: string;
    createdAt?: string | null;
    allowEntry?: boolean | null;
    allowExit?: boolean | null;
    /** The anchor region, drawn with the world task like a district's (G10). */
    wgRegionId: string;
    worldName?: string | null;
    locationId?: number | null;
    kingdomId: number;
    /** Blocks from the nearest edge of the region, 0 to 10000 (G10, G11). */
    range: number;
    /** Read only. */
    kingdom?: TerritoryNavDto | null;
}

export interface CrownLandListDto {
    id: number;
    name: string;
    wgRegionId: string;
    worldName?: string | null;
    kingdomId: number;
    kingdomName?: string | null;
    range: number;
}

// ----- Conflicts -----

export type TerritoryConflictStatus = 'Open' | 'Resolved';
export type TerritoryConflictResolution = 'None' | 'Awarded' | 'Redrawn';

export interface TerritoryConflictDto {
    id: number;
    world: string;
    holderA: TerritoryHolderDto;
    holderB: TerritoryHolderDto;
    status: TerritoryConflictStatus | string;
    stillOverlapping: boolean;
    /** The contested chunks as `[x, z]` chunk coordinates. */
    chunks: number[][];
    chunkCount: number;
    minChunkX: number;
    minChunkZ: number;
    maxChunkX: number;
    maxChunkZ: number;
    detectedAt: string;
    lastReportedAt: string;
    resolution: TerritoryConflictResolution | string;
    awardedHolder?: TerritoryHolderDto | null;
    resolvedAt?: string | null;
    resolvedByUserId?: number | null;
    resolutionNote?: string | null;
    flaggedStructures: TerritoryNavDto[];
}

export interface TerritoryConflictListDto {
    id: number;
    /** "A vs B". */
    name: string;
    world: string;
    status: TerritoryConflictStatus | string;
    stillOverlapping: boolean;
    chunkCount: number;
    resolution: TerritoryConflictResolution | string;
    detectedAt: string;
    flaggedStructureCount: number;
}

/** Award the area to one of the conflict's two holders, or mark the lines redrawn (territory DESIGN § 3). */
export interface TerritoryConflictResolveDto {
    resolution: 'Awarded' | 'Redrawn';
    /** Required for Awarded: one of the conflict's two holders. */
    awardedHolder?: TerritoryHolderDto | null;
    note?: string | null;
}

// ----- Structure loyalty and flag -----

export type StructureTerritoryFlag = 'None' | 'OutsideTerritory' | 'Contested';

export interface StructureTerritoryDto {
    structureId: number;
    structureName?: string | null;
    /** The structure's own town (through its district). */
    townId?: number | null;
    /** Null = loyal to its own town. */
    loyaltyTownId?: number | null;
    loyaltyTownName?: string | null;
    territoryFlag: StructureTerritoryFlag | string;
    territoryFlaggedAt?: string | null;
    territoryConflictId?: number | null;
}

export interface StructureLoyaltyUpdateDto {
    /** Null = loyal to its own town. */
    loyaltyTownId: number | null;
}

// ----- Town territory -----

/** A district or a crown land as the territory sees it (knk-web-api `TerritoryInputRegionDto`). */
export interface TerritoryRegionDto {
    id: number;
    name: string;
    world?: string | null;
    wgRegionId: string;
    subRegionIds: string[];
    holder: TerritoryHolderDto;
    /** Districts only. */
    isCapital: boolean;
    /** Crown land 2 outranks towns 1. */
    rank: number;
    /** Blocks from the nearest region edge, already computed (G11). */
    range: number;
}

/** The effective ranges of one town (`GET api/Territory/towns/{id}`). */
export interface TownTerritoryDto {
    townId: number;
    power: number;
    kingdomId?: number | null;
    provinceId?: number | null;
    range: number;
    capitalRange: number;
    districts: TerritoryRegionDto[];
}

/** The territory fields of a town that the town page edits (power, kingdom, province; G11). */
export interface TownTerritoryChange {
    power: number;
    kingdomId: number | null;
    provinceId: number | null;
}
