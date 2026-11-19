import { DomainBaseDto, TownDto } from '../town/TownDto';

export interface DistrictDto extends DomainBaseDto {
    townId: number;
    // town: TownDto
    streetIds?: number[];
    /** Territory V1 (PandiO/knk-workspace#326, #690): a capital's range is multiplied (G11); null on a save = unchanged. */
    isCapital?: boolean | null;
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
