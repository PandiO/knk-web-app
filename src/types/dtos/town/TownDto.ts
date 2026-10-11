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
    streetIds?: number[];
}

export interface TownCreateDto {
    name: string;
    description?: string;
    allowEntry: boolean;
    requiredTitle: number;
    streetIds?: number[];
}

export interface TownUpdateDto extends TownCreateDto {
    id: number;
}
