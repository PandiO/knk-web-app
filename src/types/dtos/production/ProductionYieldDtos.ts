// Yield areas and surveys P4 (PandiO/knk-workspace#138 API, #680 web app; PRODUCTION_KINDS.md § 3-4), mirroring
// knk-web-api `Dtos/ProductionYieldDtos.cs` and the P4 enums in `Enums/ProductionEngineEnums.cs`. Enums travel as their
// names. On create and update a null field means "keep" (create: the default).

import type { NamedRefDto } from './ProductionEngineDtos';

/** How a production area's shape is stored (PRODUCTION_KINDS § 3.1). */
export type ProductionAreaShape = 'Region' | 'Cuboid' | 'Polygon' | 'Radius';
export const PRODUCTION_AREA_SHAPES: readonly ProductionAreaShape[] = ['Region', 'Cuboid', 'Polygon', 'Radius'];

/** Why a survey ran (A10, G5). */
export type AreaSurveyTrigger = 'Creation' | 'Admin' | 'Scheduled' | 'NotableChange';

/** A Hybrid override of one output (PRODUCTION_KINDS § 4.1). */
export type ProductionYieldOverrideKind = 'Pin' | 'Exclude' | 'Scale';
export const YIELD_OVERRIDE_KINDS: readonly ProductionYieldOverrideKind[] = ['Pin', 'Exclude', 'Scale'];

/** A structure's yield source (P-D1: new structures default to Hybrid; G5: Configured is never surveyed). */
export type YieldSource = 'Derived' | 'Configured' | 'Hybrid';
export const YIELD_SOURCES: readonly YieldSource[] = ['Hybrid', 'Derived', 'Configured'];

/** One row of a kind's yield table. */
export interface ProductionYieldRowDto {
    id?: number;
    /** A survey unit key (`BLOCK:COAL_ORE`) or a prefix ending in `*` (`TREE:OAK:*`). */
    unitKey?: string | null;
    itemBlueprintId: number;
    itemBlueprint?: NamedRefDto | null;
    ratePerUnitPerHour: number;
    /** 0-1; 1 (the default) is a main output. */
    byproductChance?: number | null;
    /** 1-10 (default 1). */
    minLevel?: number | null;
}

export interface ProductionKindPrimaryOutputDto {
    id?: number;
    itemBlueprintId: number;
    itemBlueprint?: NamedRefDto | null;
}

export interface AreaPointDto {
    x: number;
    z: number;
}

/** `{ id, name }` of a production structure (knk-web-api `ProductionStructureNavDto`). */
export interface ProductionStructureNavDto {
    id: number;
    name?: string | null;
}

/**
 * A production area: `api/ProductionAreas`. Shapes: Region (wgRegionId and its bounding box), Cuboid (two corners as
 * minX..maxZ), Polygon (points plus minY/maxY) and Radius (radius around centerX/Y/Z, default the structure's Location).
 */
export interface ProductionAreaDto {
    id: number;
    productionStructureId?: number | null;
    productionStructure?: ProductionStructureNavDto | null;
    name?: string | null;
    /** Read only: the kind's area model. */
    model?: string | null;
    shape?: ProductionAreaShape | string | null;
    /** Default: the kind's (exclusive areas may not overlap). */
    exclusive?: boolean | null;
    worldName?: string | null;
    wgRegionId?: string | null;
    points?: AreaPointDto[] | null;
    centerX?: number | null;
    centerY?: number | null;
    centerZ?: number | null;
    radius?: number | null;
    minX?: number | null;
    minY?: number | null;
    minZ?: number | null;
    maxX?: number | null;
    maxY?: number | null;
    maxZ?: number | null;
    /** Read only: blocks, volume or radius by the model (what the level's maxAreaSize caps). */
    size?: number;
    /** Read only: "blocks", "volume" or "radius". */
    sizeUnit?: string | null;
    /** Read only: the cap of the structure's level (null = none). */
    maxSize?: number | null;
    enabled?: boolean | null;
    surveyRequestedAt?: string | null;
    surveyRequestTrigger?: string | null;
    lastSurveyId?: number | null;
    lastSurveyedAt?: string | null;
    createdAt?: string;
}

export interface ProductionAreaListDto {
    id: number;
    name: string;
    productionStructureId: number;
    productionStructureName: string;
    model: string;
    shape: string;
    exclusive: boolean;
    size: number;
    enabled: boolean;
    lastSurveyedAt?: string | null;
}

/** Another area whose bounding box overlaps this one (shared areas split their units, G7). */
export interface ProductionAreaOverlapDto {
    productionAreaId: number;
    name: string;
    productionStructureId: number;
    productionStructureName: string;
    model: string;
    shape: string;
    exclusive: boolean;
    wgRegionId?: string | null;
    points?: AreaPointDto[] | null;
    centerX?: number | null;
    centerY?: number | null;
    centerZ?: number | null;
    radius?: number | null;
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
}

export interface AreaSurveyUnitDto {
    id?: number;
    unitKey?: string | null;
    count: number;
    /** How many structures' areas contain these units (default 1). */
    sharedBy?: number | null;
    extra?: string | null;
}

/** A survey (`api/AreaSurveys`), posted by the game server. */
export interface AreaSurveyDto {
    id: number;
    productionAreaId: number;
    productionArea?: NamedRefDto | null;
    productionStructureId: number;
    surveyedAt?: string | null;
    receivedAt?: string;
    profileVersion?: number | null;
    trigger?: AreaSurveyTrigger | string | null;
    contentHash?: string | null;
    totalUnits: number;
    note?: string | null;
    units?: AreaSurveyUnitDto[] | null;
    materialization?: YieldMaterializationDto | null;
}

export interface AreaSurveyListDto {
    id: number;
    name: string;
    productionAreaId: number;
    productionAreaName: string;
    productionStructureId: number;
    surveyedAt: string;
    trigger: string;
    profileVersion: number;
    contentHash?: string | null;
    totalUnits: number;
}

/** One unit key's count over an area's surveys, oldest first (`GET api/AreaSurveys/trend`). */
export interface AreaSurveyTrendDto {
    productionAreaId: number;
    surveys: AreaSurveyListDto[];
    /** Unit key → count per survey, in the order of `surveys` (0 when absent). */
    series: Record<string, number[]>;
}

/** A Hybrid override: `api/ProductionYieldOverrides` (one per output and structure). */
export interface ProductionYieldOverrideDto {
    id: number;
    productionStructureId?: number | null;
    productionStructure?: ProductionStructureNavDto | null;
    itemBlueprintId?: number | null;
    itemBlueprint?: NamedRefDto | null;
    kind?: ProductionYieldOverrideKind | string | null;
    /** Pin: the base rate per hour; Scale: the factor (0-100); Exclude: ignored. */
    value?: number | null;
    note?: string | null;
    createdAt?: string;
}

export interface ProductionYieldOverrideListDto {
    id: number;
    name: string;
    productionStructureId: number;
    productionStructureName: string;
    itemBlueprintId: number;
    itemBlueprintName: string;
    kind: string;
    value: number;
}

/** One survey unit's part of an output's derived base rate. */
export interface YieldContributionDto {
    productionAreaId: number;
    areaName: string;
    areaSurveyId: number;
    unitKey: string;
    yieldRowUnitKey: string;
    count: number;
    sharedBy: number;
    share: number;
    ratePerUnitPerHour: number;
    byproductChance: number;
    /** count × share × rate × chance. */
    ratePerHour: number;
}

/** One output of a structure and how its base rate comes about. */
export interface YieldOutputDto {
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    /** Σ contributions (before overrides). */
    derivedRatePerHour: number;
    /** Pin, Exclude or Scale when a Hybrid override applies. */
    override?: ProductionYieldOverrideKind | string | null;
    overrideValue?: number | null;
    /** The base rate the engine uses (before modifiers). */
    baseRatePerHour: number;
    /** A primary output of the kind (it gets the primary multiplier as a modifier). */
    isPrimary: boolean;
    productionLineId?: number | null;
    lineRateSource?: string | null;
    contributions: YieldContributionDto[];
}

/** A structure's yield (`GET api/ProductionStructures/{id}/yield`). */
export interface ProductionYieldDto {
    productionStructureId: number;
    yieldSource: YieldSource | string;
    productionKind?: NamedRefDto | null;
    level: number;
    surveysRun: boolean;
    areas: ProductionAreaDto[];
    outputs: YieldOutputDto[];
    /** Survey units that no yield table row matches (they produce nothing). */
    unmatchedUnitKeys: string[];
    notes: string[];
}

/** What one materialization did to a structure's lines. */
export interface YieldMaterializationDto {
    productionStructureId: number;
    yieldSource: string;
    linesCreated: number[];
    linesUpdated: number[];
    /** Lines whose output the survey no longer yields (kept; their base rate is 0). */
    linesWithoutYield: number[];
    /** Outputs left to an existing Configured line of the same blueprint. */
    skippedConfigured: number[];
    notes: string[];
}

/** `POST api/ProductionStructures/{id}/survey`: optional single area (default every enabled area). */
export interface SurveyRequestDto {
    productionAreaId?: number | null;
}
