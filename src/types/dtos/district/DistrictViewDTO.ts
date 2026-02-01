import { DominionViewDTO, mapFieldDataToForm as mapDominionFieldDataToForm } from "../dominion/DominionViewDTO";
import { TownViewDTO, mapFieldDataToForm as mapTownFieldDataToForm } from "../town/TownViewDTO";
import { StreetViewDTO, mapFieldDataToForm as mapStreetFieldDataToForm } from "../street/StreetViewDTO";

export interface DistrictViewDTO extends DominionViewDTO {
    Town: TownViewDTO;
    Streets: StreetViewDTO[];
    StreetNames: Map<number, string>;
}

export function mapFieldDataToForm(data: any): any {
    if (!data) return null;
    
    const dominionForm = mapDominionFieldDataToForm(data);
    if (!dominionForm) return null;

    const townForm = data.Town ? mapTownFieldDataToForm(data.Town) : null;
    const streets = Array.isArray(data.Streets) 
        ? data.Streets.map((s: any) => mapStreetFieldDataToForm(s)).filter(Boolean)
        : [];
    
    let streetNames = new Map<number, string>();
    if (data.StreetNames) {
        if (data.StreetNames instanceof Map) {
            streetNames = data.StreetNames;
        } else if (typeof data.StreetNames === 'object') {
            streetNames = new Map(Object.entries(data.StreetNames).map(([k, v]) => [Number(k), String(v)]));
        }
    }
    
    return {
        ...dominionForm,
        town: townForm,
        streets: streets,
        streetNames: streetNames
    };
}