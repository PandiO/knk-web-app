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
    // KNG-200 catalogue fields (read-only); null on rows no server scan has seen yet.
    isItem?: boolean | null;
    isBlock?: boolean | null;
    catalogStatus?: string | null;
}
