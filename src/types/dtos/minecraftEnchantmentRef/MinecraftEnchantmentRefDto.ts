/** Catalogue status of an enchantment ref (KNG-250): Unverified until a scan has seen it, Missing once a scan no longer has it. */
export type MinecraftEnchantmentCatalogStatus = 'Unverified' | 'Active' | 'Missing';

export interface MinecraftEnchantmentRefDto {
    id?: number;
    namespaceKey: string;
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    displayName?: string | null;
    isCustom?: boolean;
    // KNG-250 catalogue fields (read-only), set by the server scan.
    catalogStatus?: MinecraftEnchantmentCatalogStatus | null;
    lastSeenVersion?: string | null;
}

export interface MinecraftEnchantmentRefListDto {
    id?: number;
    namespaceKey: string;
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    displayName?: string | null;
    isCustom?: boolean;
    // KNG-250 catalogue fields (read-only), set by the server scan.
    catalogStatus?: MinecraftEnchantmentCatalogStatus | null;
    lastSeenVersion?: string | null;
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
