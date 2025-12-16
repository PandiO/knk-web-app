import { DistrictViewDTO, mapFieldDataToForm as mapDistrictFieldDataToForm } from "../district/DistrictViewDTO";

export interface StreetViewDTO {
    Id: number;
    Name: string;
    Districts?: DistrictViewDTO[];
}

export function mapFieldDataToForm(data: any): any | null {
    if (!data) return null;

    const districts = data.Districts || data.districts || [];
    const districtsForm = districts.map((district: any) => mapDistrictFieldDataToForm(district)).filter(Boolean);

    return {
        id: data.Id || data.id,
        name: data.Name || data.name,
        districts: districtsForm
    };
}