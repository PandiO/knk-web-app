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
}

export interface ItemBlueprintListDto {
    id?: number;
    name: string;
    description: string;
    defaultDisplayName: string;
    iconMaterialRefId?: number;
    iconNamespaceKey?: string;
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
