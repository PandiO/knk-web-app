import { LocationViewDTO } from "../location/LocationViewDTO";
import { mapFieldDataToForm as mapLocationFieldDataToForm } from "../location/LocationViewDTO";

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
    if (!data) return null;
    
    return {
        id: data.Id,
        name: data.Name,
        description: data.Description,
        allowEntry: data.AllowEntry,
        created: data.Created ? new Date(data.Created) : null,
        wgRegionId: data.WgRegionId,
        location: data.Location ? mapLocationFieldDataToForm(data.Location) : null
    };
}