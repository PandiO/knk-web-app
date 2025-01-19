import { LocationCreateDTO } from "./LocationCreateDTO";

export interface DominionCreateDTO {
    Id: number;
    Name: string;
    AllowEntry: boolean;
    Created: Date;
    Description: string;
    WgRegionId: number;
    LocationId?: number;
    LocationCreateDTO?: LocationCreateDTO;
}