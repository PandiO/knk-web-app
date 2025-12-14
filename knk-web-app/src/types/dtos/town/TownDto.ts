export interface DomainBaseDto {
    id: number;
    name: string;
    description?: string;
    allowEntry: boolean;
    created?: Date;
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
