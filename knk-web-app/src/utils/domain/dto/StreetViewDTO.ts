import { DistrictViewDTO, mapFieldDataToForm as mapDistrictFieldDataToForm } from "./DistrictViewDTO";

export interface StreetViewDTO {
    Id: number;
    Name: string;
    Districts: DistrictViewDTO[];
}

export function mapFieldDataToForm(data: any): StreetViewDTO {
    var districtsForm = data.districts.map((district: any) => mapDistrictFieldDataToForm(district));
    return {
        Id: data.id,
        Name: data.name,
        Districts: districtsForm
    } as StreetViewDTO;
}