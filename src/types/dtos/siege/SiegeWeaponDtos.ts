// Siege weapons phase 1 - mirrors knk-web-api Dtos/SiegeWeaponDtos.cs (knk-workspace
// docs/specs/siege-minigame/SIEGE_WEAPONS.md § 3, § 9; PandiO/knk-workspace#782).

export type SiegeWeaponKind = 'Indirect' | 'Direct';
export type SiegeWeaponSizeClass = 'Small' | 'Medium' | 'Large';
export type SiegeAmmoEffect = 'Impact' | 'Explosion' | 'Fire' | 'Poison';
export type SiegeWeaponFacing = 'North' | 'East' | 'South' | 'West';

export interface SiegeWeaponTemplateAmmoTypeDto {
    siegeWeaponTemplateId?: number;
    siegeAmmoTypeId: number;
    siegeAmmoTypeName?: string | null;
}

export interface SiegeWeaponTemplateDto {
    id?: number;
    name: string;
    description?: string | null;
    kind: SiegeWeaponKind;
    sizeClass: SiegeWeaponSizeClass;
    /** Schematic pipeline references (PandiO/knk-workspace#614); not on the form yet. */
    armedSchematicId?: number | null;
    firedSchematicId?: number | null;
    wreckSchematicId?: number | null;
    maxHealth: number;
    buildTimeSeconds: number;
    reloadSeconds: number;
    maxRange: number;
    minRange?: number | null;
    /** Indirect only (W58, W66). */
    startSpreadRadius: number;
    minSpreadRadius: number;
    rangingStep: number;
    flightTimeAtMaxRangeSeconds: number;
    arcHeight: number;
    /** W71; null = the global default. */
    leaseIdleTimeoutSeconds?: number | null;
    /** Direct only (W24, W52). */
    coneHalfAngleDegrees: number;
    gateDamageMultiplier: number;
    weaponDamageMultiplier: number;
    spotCooldownSeconds: number;
    matchPrice: number;
    unlockPrice: number;
    /** M2M set: null/omitted keeps the saved set, [] clears it. */
    allowedAmmoTypes?: SiegeWeaponTemplateAmmoTypeDto[] | null;
}

export interface SiegeWeaponTemplateListDto {
    id: number;
    name: string;
    kind: SiegeWeaponKind;
    sizeClass: SiegeWeaponSizeClass;
    matchPrice: number;
    unlockPrice: number;
    ammoTypeCount: number;
}

export interface SiegeAmmoTypeDto {
    id?: number;
    name: string;
    description?: string | null;
    effect: SiegeAmmoEffect;
    damage: number;
    /** Gate HP units against gates and siege weapons (W65). */
    structureDamage: number;
    blastRadius: number;
    knockback: number;
    armorPiercing: number;
    projectileBlock?: string | null;
    particleTrail?: string | null;
    effectRadius?: number | null;
    effectDurationSeconds?: number | null;
    effectLevel?: number | null;
    pricePerShot: number;
}

export interface SiegeAmmoTypeListDto {
    id: number;
    name: string;
    effect: SiegeAmmoEffect;
    damage: number;
    structureDamage: number;
    blastRadius: number;
    pricePerShot: number;
}

export interface SiegeWeaponSpotDto {
    id?: number;
    siegeScenarioId: number;
    siegeTeamId: number;
    siegeTeamName?: string | null;
    sortOrder?: number | null;
    name: string;
    minX?: number | null;
    minY?: number | null;
    minZ?: number | null;
    maxX?: number | null;
    maxY?: number | null;
    maxZ?: number | null;
    wgRegionId?: string | null;
    facing: SiegeWeaponFacing;
    sizeClass: SiegeWeaponSizeClass;
}

export interface UserSiegeWeaponUnlockDto {
    id?: number;
    userId: number;
    username?: string | null;
    siegeWeaponTemplateId: number;
    siegeWeaponTemplateName?: string | null;
    /** ISO date; omitted on create = now. */
    unlockedAt?: string | null;
}
