export interface LocationViewDTO {
    Id: number;
    X: number;
    Y: number;
    Z: number;
    Pitch: number;
    Yaw: number;
    WorldName: string;
}

export function mapFieldDataToForm(data: LocationViewDTO): any {
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