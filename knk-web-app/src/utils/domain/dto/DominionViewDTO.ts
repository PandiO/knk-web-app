import { LocationViewDTO } from "./LocationViewDTO";
import { mapFieldDataToForm as mapLocationFieldDataToForm } from "./LocationViewDTO";

export interface DominionViewDTO {
    Id: number;
    Name: string;
    Description: string;
    AllowEntry: boolean;
    Created: Date;
    WgRegionId: number;
    Location: LocationViewDTO;
}

export function mapFieldDataToForm(data: DominionViewDTO): any {
    return {
        id: data.Id,
        name: data.Name,
        description: data.Description,
        allowEntry: data.AllowEntry,
        created: data.Created,
        wgRegionId: data.WgRegionId,
        location: mapLocationFieldDataToForm(data.Location)
    };
}