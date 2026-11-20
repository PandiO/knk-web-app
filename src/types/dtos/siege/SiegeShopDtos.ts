// Siege shop catalogue - mirrors knk-web-api Dtos/SiegeShopDtos.cs (knk-workspace docs/specs/siege-shop/DESIGN.md
// § 5.3, § 5.4, § 6.1-6.3; PandiO/knk-workspace#867).

export type SiegeGameMode = 'Siege' | 'SiegeSurvival';
export type SiegeShopEntryKind = 'Item' | 'SiegeWeapon';
/** § 5.4: how a price or cooldown step grows with the purchase number i. */
export type SiegeShopCurve = 'None' | 'Linear' | 'Logarithmic' | 'Exponential';

export interface SiegeShopCategoryDto {
    id?: number;
    /** Stable key ("consumables"); lower-case letters, digits and dashes. */
    key: string;
    name: string;
    iconMaterial?: string | null;
    sortOrder: number;
}

export interface SiegeShopEntryDto {
    id?: number;
    gameMode: SiegeGameMode;
    /** Null = the mode's default list; set = sold only in this scenario. */
    siegeScenarioId?: number | null;
    siegeScenarioName?: string | null;
    categoryId: number;
    categoryName?: string | null;
    kind: SiegeShopEntryKind;
    /** Kind Item. */
    itemBlueprintId?: number | null;
    itemBlueprintName?: string | null;
    quantity: number;
    /** Kind SiegeWeapon. */
    siegeWeaponTemplateId?: number | null;
    siegeWeaponTemplateName?: string | null;
    displayName?: string | null;
    iconMaterial?: string | null;
    /** Null only for weapons: the template's match price. */
    price?: number | null;
    priceStep?: number | null;
    priceCurve: SiegeShopCurve;
    /** Exponential only; null = 1.5. */
    priceGrowthFactor?: number | null;
    priceMax?: number | null;
    cooldownSeconds?: number | null;
    cooldownStepSeconds?: number | null;
    cooldownCurve: SiegeShopCurve;
    cooldownGrowthFactor?: number | null;
    cooldownMaxSeconds?: number | null;
    maxPerMatch?: number | null;
    sortOrder: number;
    enabled: boolean;
}

export interface SiegeShopEntryListDto {
    id: number;
    /** The display name, else the target's name (with "xN" for a quantity above 1). */
    name: string;
    gameMode: SiegeGameMode;
    siegeScenarioId?: number | null;
    siegeScenarioName?: string | null;
    categoryName?: string | null;
    kind: SiegeShopEntryKind;
    quantity: number;
    price?: number | null;
    maxPerMatch?: number | null;
    sortOrder: number;
    enabled: boolean;
}

/** A scenario's change to one default entry; empty fields keep the default. */
export interface SiegeScenarioShopOverrideDto {
    id?: number;
    siegeScenarioId?: number;
    siegeShopEntryId: number;
    siegeShopEntryName?: string | null;
    hidden: boolean;
    price?: number | null;
    quantity?: number | null;
    maxPerMatch?: number | null;
    cooldownSeconds?: number | null;
    priceStep?: number | null;
    cooldownStepSeconds?: number | null;
    sortOrder?: number | null;
}

/** GET SiegeShop/catalogue: what a match sells (overrides applied, weapon prices resolved). */
export interface SiegeShopCatalogueEntryDto {
    id: number;
    categoryId: number;
    kind: SiegeShopEntryKind;
    source: 'Default' | 'Overridden' | 'Scenario';
    itemBlueprintId?: number | null;
    itemBlueprintName?: string | null;
    quantity: number;
    siegeWeaponTemplateId?: number | null;
    siegeWeaponTemplateName?: string | null;
    displayName?: string | null;
    iconMaterial?: string | null;
    price: number;
    priceStep?: number | null;
    priceCurve: SiegeShopCurve;
    priceGrowthFactor?: number | null;
    priceMax?: number | null;
    cooldownSeconds?: number | null;
    cooldownStepSeconds?: number | null;
    cooldownCurve: SiegeShopCurve;
    cooldownGrowthFactor?: number | null;
    cooldownMaxSeconds?: number | null;
    maxPerMatch?: number | null;
    sortOrder: number;
}

export interface SiegeShopCatalogueCategoryDto {
    id: number;
    key: string;
    name: string;
    iconMaterial?: string | null;
    sortOrder: number;
    entries: SiegeShopCatalogueEntryDto[];
}

export interface SiegeShopCatalogueDto {
    gameMode: SiegeGameMode;
    siegeScenarioId?: number | null;
    categories: SiegeShopCatalogueCategoryDto[];
}
