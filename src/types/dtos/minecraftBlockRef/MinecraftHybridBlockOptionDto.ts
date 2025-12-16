export interface MinecraftHybridBlockOptionDto {
    id?: number | null;
    namespaceKey: string;
    blockStateString?: string | null;
    logicalType?: string | null;
    displayName: string;
    isPersisted: boolean;
    iconUrl?: string | null;
}
