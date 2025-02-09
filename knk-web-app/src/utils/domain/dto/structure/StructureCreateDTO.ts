import { DistrictCreateDTO, mapFormDataToFields as mapDistrictFormDataToFields, mapFieldDataToForm as mapDistrictFieldDataToForm } from "../district/DistrictCreateDTO";
import { DominionCreateDTO, mapFormDataToFields as mapDominionFormDataToFields, mapFieldDataToForm as mapDominionFieldDataToForm } from "../dominion/DominionCreateDTO";
import { StreetCreateDTO, mapFormDataToFields as mapStreetFormDataToFields, mapFieldDataToForm as mapStreetFieldDataToForm } from "../street/StreetCreateDTO";

export interface StructureCreateDTO extends DominionCreateDTO {
    StreetId?: number;
    Street?: StreetCreateDTO;
    StreetNumber?: number;
    DistrictId?: number;
    District?: DistrictCreateDTO;
}

export function mapFormDataToFields(data: any): StructureCreateDTO {
    // First map the DominionCreateDTO fields
    const dominionDTO = mapDominionFormDataToFields(data);

    // Then map the StructureCreateDTO fields
    const structureDTO: StructureCreateDTO = {
        ...dominionDTO,
        StreetId: data.street.id,
        Street: data.street.id < 0 ? mapStreetFormDataToFields(data.street) : undefined,
        StreetNumber: data.streetNumber,
        DistrictId: data.district.id,
        District: data.district.id < 0 ? mapDistrictFormDataToFields(data.district) : undefined
    };

    return structureDTO;
}

export function mapFieldDataToForm(data: StructureCreateDTO): any {
    // First map the DominionCreateDTO fields
    const dominionForm = mapDominionFieldDataToForm(data);

    // Then map the StructureCreateDTO fields
    return {
        ...dominionForm,
        street: data.Street ? mapStreetFieldDataToForm(data.Street) : { id: data.StreetId },
        streetNumber: data.StreetNumber,
        district: data.District ? mapDistrictFieldDataToForm(data.District) : { id: data.DistrictId }
    };
}