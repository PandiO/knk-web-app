import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "../dominion/DominionViewDTO";

export interface TownViewDTO extends DominionViewDTO {
    RequiredTitle: number;
}

export function mapFieldDataToForm(data: TownViewDTO): any {
    var dominionForm = mapDominionFieldDataToForm(data);
    // First map the DominionViewDTO fields
    const townForm = {
        ...dominionForm,
        RequiredTitle: data.RequiredTitle
    };

    return townForm;
}