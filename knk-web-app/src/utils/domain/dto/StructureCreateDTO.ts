import { DistrictCreateDTO, mapFormDataToFields as mapDistrictFormDataToFields } from "./DistrictCreateDTO";
import { DominionCreateDTO, mapFormDataToFields as mapDominionFormDataToFields } from "./DominionCreateDTO";
import { StreetCreateDTO, mapFormDataToFields as mapStreetFormDataToFields } from "./StreetCreateDTO";

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