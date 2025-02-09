import { DominionCreateDTO, mapFormDataToFields as mapDominionFormDataToFields, mapFieldDataToForm as mapDominionFieldDataToForm } from "../dominion/DominionCreateDTO";
import { TownCreateDTO, mapFormDataToFields as mapTownFormDataToFields, mapFieldDataToForm as mapTownFieldDataToForm } from "../town/TownCreateDTO";

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

export function mapFieldDataToForm(data: DistrictCreateDTO): any {
    // First map the DominionCreateDTO fields
    const dominionForm = mapDominionFieldDataToForm(data);

    // Then map the DistrictCreateDTO fields
    return {
        ...dominionForm,
        town: data.Town && mapTownFieldDataToForm(data.Town) || { id: data.TownId }
    };
}