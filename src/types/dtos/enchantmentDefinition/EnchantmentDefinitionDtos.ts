import { MinecraftEnchantmentRefDto } from "../minecraftEnchantmentRef/MinecraftEnchantmentRefDto";
import { ItemBlueprintNavDto } from "../itemBlueprint/ItemBlueprintDtos";

export interface EnchantmentDefinitionDto {
    id?: number;
    key: string;
    displayName: string;
    description?: string;
    isCustom: boolean;
    minecraftEnchantmentRefId?: number;
    maxLevel?: number;
    baseEnchantmentRef?: MinecraftEnchantmentRefDto;
    defaultForBlueprints?: ItemBlueprintNavDto[];
    abilityDefinition?: AbilityDefinitionDto;
}

export interface EnchantmentDefinitionCreateDto {
    key: string;
    displayName: string;
    description?: string;
    isCustom: boolean;
    maxLevel?: number;
    minecraftEnchantmentRefId?: number;
    enchantmentNamespaceKey?: string; // For hybrid picker
    abilityDefinition?: AbilityDefinitionUpsertDto;
}

export interface EnchantmentDefinitionUpdateDto {
    id: number;
    key: string;
    displayName: string;
    description?: string;
    isCustom: boolean;
    minecraftEnchantmentRefId?: number;
    enchantmentNamespaceKey?: string;
    abilityDefinition?: AbilityDefinitionUpsertDto;
}

export interface EnchantmentDefinitionListDto {
    id?: number;
    key: string;
    displayName: string;
    description?: string;
    maxLevel?: number;
    isCustom: boolean;
    minecraftEnchantmentRefId?: number;
    baseEnchantmentNamespaceKey?: string;
    blueprintCount?: number;
}

export interface EnchantmentDefinitionNavDto {
    id?: number;
    key: string;
    displayName: string;
    isCustom: boolean;
}

export interface MinecraftEnchantmentRefNavDto {
    id?: number;
    namespaceKey: string;
    displayName?: string;
    maxLevel?: number;
    iconUrl?: string;
}

export interface AbilityDefinitionDto {
    id?: number;
    enchantmentDefinitionId: number;
    abilityKey: string;
    runtimeConfigJson?: string;
    futureUserAssignmentContract?: string;
}

export interface AbilityDefinitionUpsertDto {
    abilityKey: string;
    runtimeConfigJson?: string;
    futureUserAssignmentContract?: string;
}
