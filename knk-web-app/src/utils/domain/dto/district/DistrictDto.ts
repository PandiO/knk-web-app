import { DomainBaseDto, TownDto } from '../town/TownDto';

export interface DistrictDto extends DomainBaseDto {
    townId: number;
    // town: TownDto
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
