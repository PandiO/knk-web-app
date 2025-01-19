import { DominionCreateDTO } from "./DominionCreateDTO";

export interface TownCreateDTO extends DominionCreateDTO {
    RequiredTitle: number;
}