import { DistrictViewDTO, mapFieldDataToForm as mapDistrictFieldDataToForm } from "../district/DistrictViewDTO";
import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "../dominion/DominionViewDTO";
import { StorageViewConciseDTO } from "../item/StorageViewConciseDTO";

export interface StructureStreetViewDTO {
    Id: number;
    Name: string;
    Districts: Map<number, string>;
}

export function mapStreetFieldDataToForm(data: any): any {
    var districts = new Map<number, string>();
    data.Districts?.forEach((d: any) => {
        districts.set(d.id, d.name);
    });

    return {
        id: data.Id,
        name: data.Name,
        districts: districts
    };
}

export interface StructureViewDTO extends DominionViewDTO {
    Street: StructureStreetViewDTO;
    StreetNumber: number;
    District: DistrictViewDTO;
    storages: StorageViewConciseDTO[];
}

export function mapFieldDataToForm(data: StructureViewDTO): any {
    var dominionForm = mapDominionFieldDataToForm(data);
    var streetForm = data.Street ? mapStreetFieldDataToForm(data.Street) : null;
    var districtForm = data.District ? mapDistrictFieldDataToForm(data.District) : null;

    return {
        ...dominionForm,
        street: streetForm,
        streetNumber: data.StreetNumber,
        district: districtForm,
        storages: data.storages
    };
}