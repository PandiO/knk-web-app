export interface MinecraftHybridEnchantmentOptionDto {
    type: "PERSISTED" | "CATALOG";
    namespaceKey: string;
    displayName?: string | null;
    legacyName?: string | null;
    category?: string | null;
    iconUrl?: string | null;
    maxLevel?: number | null;
    id?: number | null;
    isCustom?: boolean;
}
