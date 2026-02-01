import { iLocationCreateDTO, mapFormDataToFields as mapLocationFormDataToFields, mapFieldDataToForm as mapLocationFieldDataToForm } from "../location/LocationCreateDTO";

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

export function mapFieldDataToForm(data: DominionCreateDTO): any {
    return {
        id: data.Id,
        name: data.Name,
        allowEntry: data.AllowEntry,
        created: data.Created,
        description: data.Description,
        wgRegionId: data.WgRegionId,
        location: data.LocationCreateDTO ? mapLocationFieldDataToForm(data.LocationCreateDTO) : { id: data.LocationId }
    };
}