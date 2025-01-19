import { DistrictCreateDTO } from "./DistrictCreateDTO";

export interface StreetCreateDTO {
    Id: number;
    Name: string;
    DistrictId?: number;
    District?: DistrictCreateDTO;
}