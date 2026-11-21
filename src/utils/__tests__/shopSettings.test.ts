import { defaultShopSettings, shopSettingsErrors } from '../shopSettings';
import { normalizeProductionSettings } from '../territory';

// Game settings section `production.shops` (PandiO/knk-workspace#938): the API's defaults and checks
// (knk-web-api `ProductionSettings.ValidateShops`).
describe('shop settings', () => {
    it('has the API defaults, which are valid', () => {
        expect(defaultShopSettings()).toEqual({ enchantmentPercentPerLevel: 10, statsLookbackHours: 2 });
        expect(shopSettingsErrors(defaultShopSettings())).toEqual([]);
    });

    it('accepts the bounds and a fractional percentage', () => {
        expect(shopSettingsErrors({ enchantmentPercentPerLevel: 0, statsLookbackHours: 0 })).toEqual([]);
        expect(shopSettingsErrors({ enchantmentPercentPerLevel: 1000, statsLookbackHours: 168 })).toEqual([]);
        expect(shopSettingsErrors({ enchantmentPercentPerLevel: 12.5, statsLookbackHours: 3 })).toEqual([]);
    });

    it('refuses what the API refuses, one sentence per field', () => {
        expect(shopSettingsErrors({ enchantmentPercentPerLevel: -1, statsLookbackHours: 169 })).toEqual([
            'production.shops.enchantmentPercentPerLevel must be a number between 0 and 1000.',
            'production.shops.statsLookbackHours must be a whole number between 0 and 168.',
        ]);
        expect(shopSettingsErrors({ enchantmentPercentPerLevel: Number.NaN, statsLookbackHours: 2.5 })).toHaveLength(2);
    });

    it('is kept as stored and filled with the defaults by the production normalizer', () => {
        expect(normalizeProductionSettings({ shops: { enchantmentPercentPerLevel: 15, statsLookbackHours: 3 } }).shops)
            .toEqual({ enchantmentPercentPerLevel: 15, statsLookbackHours: 3 });
        expect(normalizeProductionSettings(null).shops).toEqual(defaultShopSettings());
    });
});
