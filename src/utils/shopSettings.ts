import type { ProductionShopSettingsDto } from '../types/dtos/production/ShopDtos';

// Game settings section `production.shops` in the web app (PandiO/knk-workspace#938; shops DESIGN § 4): the defaults
// and the checks the API makes (knk-web-api `ProductionSettings.ValidateShops`). Kept apart from `shops.ts`, which
// imports a component, so the settings normalizer can import it.

/** The API's defaults (`ProductionShopSettingsDto`). */
export const defaultShopSettings = (): ProductionShopSettingsDto => ({
    enchantmentPercentPerLevel: 10,
    statsLookbackHours: 2,
});

/** The API's bounds for `production.shops`: [min, max, whole numbers only]. */
export const SHOP_SETTINGS_LIMITS: Record<keyof ProductionShopSettingsDto, [number, number, boolean]> = {
    enchantmentPercentPerLevel: [0, 1000, false],
    statsLookbackHours: [0, 168, true],
};

/** The shop settings the API would refuse, one sentence each; empty when valid. */
export function shopSettingsErrors(settings: ProductionShopSettingsDto): string[] {
    const errors: string[] = [];
    (Object.keys(SHOP_SETTINGS_LIMITS) as (keyof ProductionShopSettingsDto)[]).forEach(key => {
        const [min, max, whole] = SHOP_SETTINGS_LIMITS[key];
        const value = settings[key];
        if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
            errors.push(`production.shops.${key} must be ${whole ? 'a whole number' : 'a number'} between ${min} and ${max}.`);
        }
    });
    return errors;
}
