// PandiO/knk-workspace#221: the public info sheets of the custom enchantments and abilities (knk-web-api
// GET EnchantmentDefinitions/public/info). Every number is the live combat value, worked out per level.

export type EnchantmentInfoTrigger = 'OnHit' | 'RightClick' | 'GateHit' | 'Unknown';
export type EnchantmentInfoApplication = 'Target' | 'Self' | 'Area' | 'Gate' | 'Unknown';
export type EnchantmentInfoAppliesTo = 'Target' | 'Self' | 'PlayersInRange';

export interface EnchantmentInfoEffectDto {
    name: string;
    /** 1 = I; null when the effect has no levels */
    potionLevel?: number | null;
    durationSeconds?: number | null;
    appliesTo: EnchantmentInfoAppliesTo | string;
    note?: string | null;
}

export interface EnchantmentInfoLevelDto {
    level: number;
    /** null = always goes off (abilities) */
    chancePercent?: number | null;
    /** 0 = no cooldown */
    cooldownSeconds: number;
    effects: EnchantmentInfoEffectDto[];
    areaDamage?: number | null;
    gateDamage?: number | null;
    /** health points; 2 = one heart */
    healAmount?: number | null;
    detail?: string | null;
}

export interface EnchantmentInfoDto {
    key: string;
    displayName: string;
    description?: string | null;
    maxLevel: number;
    trigger: EnchantmentInfoTrigger | string;
    application: EnchantmentInfoApplication | string;
    summary: string;
    damageRadiusBlocks?: number | null;
    knockbackRadiusBlocks?: number | null;
    armourReducesDamage?: boolean | null;
    notes: string[];
    levels: EnchantmentInfoLevelDto[];
}

export const TRIGGER_LABELS: Record<string, string> = {
    OnHit: 'On hit',
    RightClick: 'Right-click ability',
    GateHit: 'Gate hits',
    Unknown: 'Custom',
};

export const APPLICATION_LABELS: Record<string, string> = {
    Target: 'The one you hit',
    Self: 'Yourself',
    Area: 'Everyone around you',
    Gate: 'Gate doors',
    Unknown: '-',
};

export const APPLIES_TO_LABELS: Record<string, string> = {
    Target: 'target',
    Self: 'you',
    PlayersInRange: 'players in range',
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** 1 → I ... 10 → X; larger numbers as digits. */
export function toRoman(value: number): string {
    return Number.isInteger(value) && value >= 1 && value < ROMAN.length ? ROMAN[value] : String(value);
}

/** 4.5 → "4.5", 60 → "60", 2.25 → "2.25". */
export function formatInfoNumber(value: number): string {
    return String(Math.round(value * 100) / 100);
}
