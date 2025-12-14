export interface MinecraftMaterialRefDto {
    id?: number | null;
    namespaceKey: string;
    legacyName?: string | null;
    category: string;
    iconUrl?: string | null;
}

export interface MinecraftMaterialRefCreateDto {
    namespaceKey: string;
    legacyName?: string | null;
    category: string;
    iconUrl?: string | null;
}

export interface MinecraftMaterialRefUpdateDto {
    namespaceKey: string;
    legacyName?: string | null;
    category: string;
    iconUrl?: string | null;
}

export interface MinecraftMaterialRefListDto {
    id?: number | null;
    namespaceKey: string;
    category: string;
    legacyName?: string | null;
    displayName?: string;
    isPersisted?: boolean;
    iconUrl?: string | null;
}
