import { DominionCreateDTO, mapFormDataToFields as mapDominionFormDataToFields, mapFieldDataToForm as mapDominionFieldDataToForm } from "./DominionCreateDTO";

export interface TownCreateDTO extends DominionCreateDTO {
    RequiredTitle: number;
}

export function mapFormDataToFields(data: any): TownCreateDTO {
    // First map the DominionCreateDTO fields
    const dominionDTO = mapDominionFormDataToFields(data);

    // Then map the TownCreateDTO fields
    const townDTO: TownCreateDTO = {
        ...dominionDTO,
        RequiredTitle: data.requiredTitle
    };

    return townDTO;
}

export function mapFieldDataToForm(data: TownCreateDTO): any {
    // First map the DominionCreateDTO fields
    const dominionForm = mapDominionFieldDataToForm(data);

    // Then map the TownCreateDTO fields
    return {
        ...dominionForm,
        requiredTitle: data.RequiredTitle
    };
}