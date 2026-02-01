export interface MinecraftEnchantmentRefDto {
    id?: number;
    namespaceKey: string;
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    displayName?: string | null;
    isCustom?: boolean;
    isPersisted?: boolean;
}

export interface MinecraftEnchantmentRefListDto {
    id?: number;
    namespaceKey: string;
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    displayName?: string | null;
    isPersisted?: boolean;
}

export interface MinecraftEnchantmentRefCreateDto {
    namespaceKey: string;
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    displayName?: string | null;
}

export interface MinecraftEnchantmentRefUpdateDto {
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    displayName?: string | null;
}
