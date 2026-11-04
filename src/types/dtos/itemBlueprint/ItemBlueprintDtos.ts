import { MinecraftMaterialRefDto } from "../minecraftMaterialRef/MinecraftMaterialRefDto";
import { EnchantmentDefinitionNavDto } from "../enchantmentDefinition/EnchantmentDefinitionDtos";

export interface ItemBlueprintDto {
    id?: number;
    name: string;
    description: string;
    iconMaterialRefId?: number;
    iconMaterialRef?: MinecraftMaterialRefDto;
    iconNamespaceKey?: string;
    defaultDisplayName: string;
    defaultDisplayDescription: string;
    defaultQuantity?: number;
    maxStackSize?: number;
    defaultEnchantments?: ItemBlueprintDefaultEnchantmentDto[];
    // PandiO/knk-workspace#232: a shield's banner (base dye colour + layers bottom to top) and an armour piece's
    // trim (pattern + material keys, both or neither). Null / empty on any other item.
    shieldBannerBaseColor?: string | null;
    shieldBannerLayers?: ItemBannerLayerDto[];
    armorTrimPattern?: string | null;
    armorTrimMaterial?: string | null;
}

/** One banner pattern layer of a shield (#232); lists are bottom to top. Mirrors the API's ItemBannerLayerDto. */
export interface ItemBannerLayerDto {
    /** Banner pattern registry key, e.g. "minecraft:stripe_top" (GET /api/BannerDesigns/pattern-keys lists them). */
    patternKey: string;
    /** Dye colour name as org.bukkit.DyeColor spells it, e.g. "RED". */
    color: string;
}

export interface ItemBlueprintListDto {
    id?: number;
    name: string;
    description: string;
    defaultDisplayName: string;
    iconMaterialRefId?: number;
    iconNamespaceKey?: string;
    /** KNG-200: the icon material's picture (manual override first); null when it has none. */
    iconUrl?: string | null;
    defaultEnchantmentsCount?: number;
}

export interface ItemBlueprintDefaultEnchantmentDto {
    itemBlueprintId?: number;
    enchantmentDefinitionId?: number;
    enchantmentDefinition?: EnchantmentDefinitionNavDto;
    level: number;
}

export interface ItemBlueprintNavDto {
    id?: number;
    name: string;
    iconMaterialRefId?: number;
    defaultDisplayName: string;
}
