import { DistrictCreateDTO, mapFormDataToFields as mapDistrictFormDataToFields } from "./DistrictCreateDTO";

export interface StreetCreateDTO {
    Id: number;
    Name: string;
    DistrictId?: number;
    District?: DistrictCreateDTO;
}

export function mapFormDataToFields(data: any): StreetCreateDTO {
    return {
        Id: data.id,
        Name: data.name,
        DistrictId: data.district.id,
        District: data.district.id < 0 ? mapDistrictFormDataToFields(data.district) : undefined
    } as StreetCreateDTO;
}