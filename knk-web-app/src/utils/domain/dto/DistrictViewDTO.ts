import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "./DominionViewDTO";
import { TownViewDTO, mapFieldDataToForm as mapTownFieldDataToForm } from "./TownViewDTO";
import { StreetViewDTO, mapFieldDataToForm as mapStreetFieldDataToForm } from "./StreetViewDTO";

export interface DistrictViewDTO extends DominionViewDTO {
    Town: TownViewDTO;
    Streets: StreetViewDTO[];
    StreetNames: Map<number, string>;
}

export function mapFieldDataToForm(data: any): DistrictViewDTO {
    var dominionForm = mapDominionFieldDataToForm(data);
    var townForm = mapTownFieldDataToForm(data.town);
    var streets = data.streets?.map((street: any) => mapStreetFieldDataToForm(street));
    var streetNames = new Map<number, string>(Object.entries(data.streetNames).map(([key, value]) => [parseInt(key), value as string]));
    return {
        ...dominionForm,
        Town: townForm,
        Streets: streets,
        StreetNames: streetNames
    } as DistrictViewDTO;
}