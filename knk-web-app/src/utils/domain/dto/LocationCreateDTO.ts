export interface iLocationCreateDTO {
    Id: number;
    X: number;
    Y: number;
    Z: number;
    Pitch: number;
    Yaw: number;
    WorldName: string;
}

export class LocationCreateDTO implements LocationCreateDTO {
    Name: string = 'Location';
}

export function mapFormDataToFields(data: any): iLocationCreateDTO {
    return {
        Id: data.id,
        X: data.x,
        Y: data.y,
        Z: data.z,
        Pitch: data.pitch,
        Yaw: data.yaw,
        WorldName: data.worldName
    } as iLocationCreateDTO;
}

export function mapFieldDataToForm(data: iLocationCreateDTO): any {
    return {
        id: data.Id,
        x: data.X,
        y: data.Y,
        z: data.Z,
        pitch: data.Pitch,
        yaw: data.Yaw,
        worldName: data.WorldName
    };
}