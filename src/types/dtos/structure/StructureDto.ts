import { DomainBaseDto } from '../town/TownDto';

export interface StructureDto extends DomainBaseDto {
    streetId: number;
    districtId: number;
    streetNumber: number;
}

export interface StructureCreateDto {
    name: string;
    description?: string;
    allowEntry: boolean;
    streetId: number;
    districtId: number;
    streetNumber: number;
}

export interface StructureUpdateDto extends StructureCreateDto {
    id: number;
}
