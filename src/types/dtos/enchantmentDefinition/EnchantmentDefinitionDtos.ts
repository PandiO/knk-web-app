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
    // PandiO/knk-workspace#151: combat values of a custom enchantment; null/absent = the plugin's built-in value.
    procChancePercent?: number | null;
    procChancePerLevelPercent?: number | null;
    cooldownEnabled?: boolean | null;
    cooldownSeconds?: number | null;
    effectDurationSeconds?: number | null;
    levelMultiplier?: number | null;
    // PandiO/knk-workspace#201: Flash Chaos only: its Slowness level (1 = I) and its Nausea duration at level I.
    effectLevel?: number | null;
    secondaryEffectDurationSeconds?: number | null;
    // PandiO/knk-workspace#223: Chaos / Flash Chaos only: area damage and gate damage at level I, radii in blocks.
    areaDamage?: number | null;
    gateDamage?: number | null;
    damageRadiusBlocks?: number | null;
    effectRadiusBlocks?: number | null;
}

export interface EnchantmentDefinitionCreateDto {
    key: string;
    displayName: string;
    description?: string;
    isCustom: boolean;
    maxLevel?: number;
    minecraftEnchantmentRefId?: number;
    enchantmentNamespaceKey?: string; // Links (or creates as Unverified) the ref with this key when no ref id is sent
    abilityDefinition?: AbilityDefinitionUpsertDto;
    // PandiO/knk-workspace#151: combat values of a custom enchantment; null/absent = the plugin's built-in value.
    procChancePercent?: number | null;
    procChancePerLevelPercent?: number | null;
    cooldownEnabled?: boolean | null;
    cooldownSeconds?: number | null;
    effectDurationSeconds?: number | null;
    levelMultiplier?: number | null;
    // PandiO/knk-workspace#201: Flash Chaos only: its Slowness level (1 = I) and its Nausea duration at level I.
    effectLevel?: number | null;
    secondaryEffectDurationSeconds?: number | null;
    // PandiO/knk-workspace#223: Chaos / Flash Chaos only: area damage and gate damage at level I, radii in blocks.
    areaDamage?: number | null;
    gateDamage?: number | null;
    damageRadiusBlocks?: number | null;
    effectRadiusBlocks?: number | null;
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
    // Only the combat values present in the request are written; an explicit null resets one to the built-in value.
    procChancePercent?: number | null;
    procChancePerLevelPercent?: number | null;
    cooldownEnabled?: boolean | null;
    cooldownSeconds?: number | null;
    effectDurationSeconds?: number | null;
    levelMultiplier?: number | null;
    // PandiO/knk-workspace#201: Flash Chaos only: its Slowness level (1 = I) and its Nausea duration at level I.
    effectLevel?: number | null;
    secondaryEffectDurationSeconds?: number | null;
    // PandiO/knk-workspace#223: Chaos / Flash Chaos only: area damage and gate damage at level I, radii in blocks.
    areaDamage?: number | null;
    gateDamage?: number | null;
    damageRadiusBlocks?: number | null;
    effectRadiusBlocks?: number | null;
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
