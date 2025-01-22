import { iLocationCreateDTO, mapFormDataToFields as mapLocationFormDataToFields } from "./LocationCreateDTO";

export interface DominionCreateDTO {
    Id: number;
    Name: string;
    AllowEntry: boolean;
    Created: Date;
    Description: string;
    WgRegionId: number;
    LocationId?: number;
    LocationCreateDTO?: iLocationCreateDTO;
}

export function mapFormDataToFields(data: any): DominionCreateDTO {
    return {
        Id: data.id,
        Name: data.name,
        AllowEntry: data.allowEntry,
        Created: data.created,
        Description: data.description,
        WgRegionId: data.wgRegionId,
        LocationId: data.location.id,
        LocationCreateDTO: data.location.id < 0 ? mapLocationFormDataToFields(data.location) : undefined
    } as DominionCreateDTO;
}