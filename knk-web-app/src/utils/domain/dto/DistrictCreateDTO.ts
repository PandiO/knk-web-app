import { DominionCreateDTO, mapFormDataToFields as mapDominionFormDataToFields } from "./DominionCreateDTO";
import { TownCreateDTO, mapFormDataToFields as mapTownFormDataToFields } from "./TownCreateDTO";

export interface DistrictCreateDTO extends DominionCreateDTO {
    TownId?: number;
    Town?: TownCreateDTO;
}

export function mapFormDataToFields(data: any): DistrictCreateDTO {
    // First map the DominionCreateDTO fields
    const dominionCreateDTO = mapDominionFormDataToFields(data);

    // Then map the DistrictCreateDTO fields
    const districtDTO: DistrictCreateDTO = {
        ...dominionCreateDTO,
        TownId: data.town.id,
        Town: data.town.id < 0 ? mapTownFormDataToFields(data.town) : undefined
    };

    return districtDTO;
}