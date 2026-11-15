import { DomainNavigationDefaultSettingsDto, DomainTeleportSettingsDto } from '../domain/DomainDtos';

export interface DomainBaseDto extends DomainTeleportSettingsDto, DomainNavigationDefaultSettingsDto {
    id: number;
    name: string;
    description?: string;
    allowEntry: boolean;
    created?: Date;
    /** KNG-111: the Minecraft world of the domain and its region. */
    worldName?: string | null;
}

export interface TownDto extends DomainBaseDto {
    requiredTitle: number;
    /** #409: read-only, the distinct streets of the town's districts (change them on a district). */
    streetIds?: number[];
    /** #409: the same streets with their names, ordered by name (knk-web-api `TownStreetDto`). */
    streets?: TownStreetDto[];
}

/** knk-web-api `TownStreetDto`: one street of a town (derived from its districts, #409). */
export interface TownStreetDto {
    id: number;
    name: string;
}

export interface TownCreateDto {
    name: string;
    description?: string;
    allowEntry: boolean;
    requiredTitle: number;
}

export interface TownUpdateDto extends TownCreateDto {
    id: number;
}
