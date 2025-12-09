export interface MinecraftBlockRefDto {
    id?: number | null;
    namespaceKey: string;
    blockStateString?: string | null;
    logicalType?: string | null;
}

export interface MinecraftBlockRefCreateDto {
    namespaceKey: string;
    blockStateString?: string | null;
    logicalType?: string | null;
}

export interface MinecraftBlockRefUpdateDto {
    namespaceKey: string;
    blockStateString?: string | null;
    logicalType?: string | null;
}

export interface MinecraftBlockRefListDto {
    id?: number | null;
    namespaceKey: string;
    logicalType?: string | null;
}
