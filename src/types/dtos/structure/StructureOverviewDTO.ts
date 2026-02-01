import { FilterType, StructureOverviewFilter } from "../../../enums";

export interface StructureOverviewArgumentsDTO {
  filters: Map<StructureOverviewFilter, number[]>;
  filterType: FilterType;
}

export interface StructureOverviewDTO {
  id: number;
  name: string;
  streetId?: number;
  streetName: string;
  districtId?: number;
  districtName?: string;
  streetNumber?: number;
  townId?: number;
  townName?: string;
}

export function mapFieldDataToForm(data: any): StructureOverviewDTO {
  return {
    id: data.Id,
    name: data.Name,
    streetId: data.StreetId,
    streetName: data.StreetName,
    districtId: data.DistrictId,
    districtName: data.DistrictName,
    streetNumber: data.StreetNumber,
    townId: data.TownId,
    townName: data.TownName,
  };
}