export interface MinecraftMaterialRefDto {
    id?: number | null;
    namespaceKey: string;
    legacyName?: string | null;
    category: string;
}

export interface MinecraftMaterialRefCreateDto {
    namespaceKey: string;
    legacyName?: string | null;
    category: string;
}

export interface MinecraftMaterialRefUpdateDto {
    namespaceKey: string;
    legacyName?: string | null;
    category: string;
}

export interface MinecraftMaterialRefListDto {
    id?: number | null;
    namespaceKey: string;
    category: string;
}
