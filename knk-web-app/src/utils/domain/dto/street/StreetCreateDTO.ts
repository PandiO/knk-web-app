import { DistrictCreateDTO, mapFormDataToFields as mapDistrictFormDataToFields, mapFieldDataToForm as mapDistrictFieldDataToForm } from "../district/DistrictCreateDTO";

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

export function mapFieldDataToForm(data: StreetCreateDTO): any {
    return {
        id: data.Id,
        name: data.Name,
        district: data.District ? mapDistrictFieldDataToForm(data.District) : { id: data.DistrictId }
    };
}