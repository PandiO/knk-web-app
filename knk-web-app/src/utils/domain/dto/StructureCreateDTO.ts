import { DistrictCreateDTO } from "./DistrictCreateDTO";
import { DominionCreateDTO } from "./DominionCreateDTO";
import { StreetCreateDTO } from "./StreetCreateDTO";

export interface StructureCreateDTO extends DominionCreateDTO {
    StreetId?: number;
    Street?: StreetCreateDTO;
    StreetNumber?: number;
    DistrictId?: number;
    District?: DistrictCreateDTO;
}