export interface MinecraftHybridMaterialOptionDto {
    id?: number | null;
    namespaceKey: string;
    category: string;
    legacyName?: string | null;
    displayName: string;
    isPersisted: boolean;
    iconUrl?: string | null;
}
