import { DominionCreateDTO } from "./DominionCreateDTO";
import { TownCreateDTO } from "./TownCreateDTO";

export interface DistrictCreateDTO extends DominionCreateDTO {
    TownId?: number;
    Town?: TownCreateDTO;
}