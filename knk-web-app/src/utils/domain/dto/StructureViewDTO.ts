import { DistrictViewDTO, mapFieldDataToForm as mapDistrictFieldDataToForm } from "./DistrictViewDTO";
import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "./DominionViewDTO";

export interface StructureStreetViewDTO {
    Id: number;
    Name: string;
    Districts: Map<number, string>;
}

export function mapStreetFieldDataToForm(data: any): StructureStreetViewDTO {
    var districts = new Map<number, string>();
    data.districts?.forEach((district: any) => {
        districts.set(district.id, district.name);
    });

    return {
        Id: data.id,
        Name: data.name,
        Districts: districts
    } as StructureStreetViewDTO;
}

export interface StructureViewDTO extends DominionViewDTO {
    Street: StructureStreetViewDTO;
    StreetNumber: number;
    District: DistrictViewDTO;
}

export function mapFieldDataToForm(data: any): StructureViewDTO {
    var dominionForm = mapDominionFieldDataToForm(data);
    var streetForm = data.street ? mapStreetFieldDataToForm(data.street) : null;
    var districtForm = data.district ? mapDistrictFieldDataToForm(data.district) : null;

    return {
        ...dominionForm,
        Street: streetForm,
        StreetNumber: data.streetNumber,
        District: districtForm
    } as StructureViewDTO;
}