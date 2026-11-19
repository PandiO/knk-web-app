import { DomainBaseDto } from '../town/TownDto';

export interface StructureDto extends DomainBaseDto {
    // Placement (P2, PandiO/knk-workspace#91 API, #676 web app): in a district (districtId + streetId + houseNumber) or
    // rural (townId, no street, houseNumber 0). Exactly one of districtId and townId is set (knk-web-api `StructureDto`).
    streetId?: number | null;
    districtId?: number | null;
    streetNumber?: number;
    houseNumber?: number;
    townId?: number | null;
    /** Read only: the district's town, or townId for a rural structure. */
    effectiveTownId?: number | null;
    /** Read only: true when the structure has no district. */
    isRural?: boolean | null;
    /** Read only, on create: placement rules that failed as warnings (P-1 to P-3 warn by default). */
    placementWarnings?: string[] | null;
    wgRegionId?: string | null;
    // Territory (PandiO/knk-workspace#326), read only here.
    loyaltyTownId?: number | null;
    territoryFlag?: string | null;
    territoryFlaggedAt?: string | null;
    territoryConflictId?: number | null;
    street?: StructureStreetDto | null;
    district?: StructureDistrictDto | null;
    /** Read only: the rural structure's town (null for a structure in a district). */
    town?: StructureTownDto | null;
}

/** knk-web-api `StructureDistrictDto`: the district embedded in a structure read. */
export interface StructureDistrictDto {
    id?: number | null;
    name?: string | null;
    wgRegionId?: string | null;
    worldName?: string | null;
    townName?: string | null;
}

/** knk-web-api `StructureStreetDto`. */
export interface StructureStreetDto {
    id?: number | null;
    name?: string | null;
}

/** knk-web-api `StructureTownDto`: a rural structure's town (P2, #91). */
export interface StructureTownDto {
    id?: number | null;
    name?: string | null;
    wgRegionId?: string | null;
    worldName?: string | null;
}

/** knk-web-api `StructureListDto`: a structure search row. */
export interface StructureListDto {
    id: number;
    name: string;
    description?: string | null;
    wgRegionId?: string | null;
    worldName?: string | null;
    houseNumber: number;
    streetId?: number | null;
    streetName?: string | null;
    districtId?: number | null;
    districtName?: string | null;
    /** P2 (#91): the structure's town (its district's, or its own when rural). */
    townId?: number | null;
    townName?: string | null;
    isRural: boolean;
    territoryFlag?: string | null;
}

export interface StructureCreateDto {
    name: string;
    description?: string;
    allowEntry: boolean;
    streetId?: number | null;
    districtId?: number | null;
    streetNumber?: number;
    townId?: number | null;
}

export interface StructureUpdateDto extends StructureCreateDto {
    id: number;
}
