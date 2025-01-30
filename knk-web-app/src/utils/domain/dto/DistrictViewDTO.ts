import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "./DominionViewDTO";
import { TownViewDTO, mapFieldDataToForm as mapTownFieldDataToForm } from "./TownViewDTO";
import { StreetViewDTO, mapFieldDataToForm as mapStreetFieldDataToForm } from "./StreetViewDTO";

export interface DistrictViewDTO extends DominionViewDTO {
    Town: TownViewDTO;
    Streets: StreetViewDTO[];
    StreetNames: Map<number, string>;
}

export function mapFieldDataToForm(data: any): any {
    var dominionForm = mapDominionFieldDataToForm(data);
    var townForm = data.Town ? mapTownFieldDataToForm(data.Town) : null;
    var streets = data.Streets?.map((s: any) => mapStreetFieldDataToForm(s));
    var streetNames = data.StreetNames ? new Map<number, string>(Object.entries(data.StreetNames).map(([key, value]) => [parseInt(key), value as string])) : null;
    return {
        ...dominionForm,
        town: townForm,
        streets: streets,
        streetNames: streetNames
    };
}