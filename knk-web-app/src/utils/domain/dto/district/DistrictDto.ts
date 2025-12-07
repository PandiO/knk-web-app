import { DomainBaseDto } from '../town/TownDto';

export interface DistrictDto extends DomainBaseDto {
    townId: number;
    streetIds?: number[];
}

export interface DistrictCreateDto {
    name: string;
    description?: string;
    allowEntry: boolean;
    townId: number;
    streetIds?: number[];
}

export interface DistrictUpdateDto extends DistrictCreateDto {
    id: number;
}
