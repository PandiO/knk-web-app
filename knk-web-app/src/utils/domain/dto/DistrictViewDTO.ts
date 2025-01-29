import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "./DominionViewDTO";
import { TownViewDTO, mapFieldDataToForm as mapTownFieldDataToForm } from "./TownViewDTO";
import { StreetViewDTO, mapFieldDataToForm as mapStreetFieldDataToForm } from "./StreetViewDTO";

export interface DistrictViewDTO extends DominionViewDTO {
    Town: TownViewDTO;
    Streets: StreetViewDTO[]
}

export function mapFieldDataToForm(data: any): DistrictViewDTO {
    var dominionForm = mapDominionFieldDataToForm(data);
    var townForm = mapTownFieldDataToForm(data.town);
    var streets = data.streets.map((street: any) => mapStreetFieldDataToForm(street));

    return {
        ...dominionForm,
        Town: townForm,
        Streets: streets
    } as DistrictViewDTO;
}