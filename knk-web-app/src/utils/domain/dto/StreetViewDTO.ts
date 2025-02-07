import { DistrictViewDTO, mapFieldDataToForm as mapDistrictFieldDataToForm } from "./DistrictViewDTO";

export interface StreetViewDTO {
    Id: number;
    Name: string;
    Districts?: DistrictViewDTO[];
}

export function mapFieldDataToForm(data: any): StreetViewDTO | null {
    if (!data) return null;

    const districts = data.Districts || data.districts || [];
    const districtsForm = districts.map((district: any) => mapDistrictFieldDataToForm(district)).filter(Boolean);

    return {
        Id: data.Id || data.id,
        Name: data.Name || data.name,
        Districts: districtsForm
    } as StreetViewDTO;
}