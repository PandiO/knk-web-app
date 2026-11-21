import React from 'react';
import type { ProductionShopSettingsDto } from '../../../types/dtos/production/ShopDtos';
import { SHOP_SETTINGS_LIMITS, defaultShopSettings, shopSettingsErrors } from '../../../utils/shopSettings';

interface Props {
    value: ProductionShopSettingsDto | undefined;
    changed?: boolean;
    onChange: (value: ProductionShopSettingsDto) => void;
}

/** A number from an input; empty or text becomes NaN, which the inline check reports and the API refuses. */
const toNumber = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw));

const FIELDS: { key: keyof ProductionShopSettingsDto; label: string; help: string }[] = [
    {
        key: 'enchantmentPercentPerLevel', label: 'Enchantment surcharge (% per level)',
        help: 'A unique item\'s price rises by this share of its base price per enchantment level (F3: 10).',
    },
    {
        key: 'statsLookbackHours', label: 'Trade stats lookback (hours)',
        help: 'The hourly trade stats also recompute this many earlier hours, for late ledger rows (2).',
    },
];

/**
 * Game settings section `production.shops` (PandiO/knk-workspace#248 API, #938 web app; shops DESIGN § 4): the
 * enchantment surcharge of a unique item's interim price and the trade stats' lookback, saved with the page's other
 * sections. Shop types, levels and catalogues are on their own pages (World group).
 */
export const ShopSettingsCard: React.FC<Props> = ({ value, changed, onChange }) => {
    const settings = value ?? defaultShopSettings();
    const errors = shopSettingsErrors(settings);

    return (
        <section className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3" aria-labelledby="production-shops-settings-heading">
            <h2 id="production-shops-settings-heading" className="text-lg font-semibold text-fg">
                Shops{changed ? <span className="ml-2 text-xs font-normal text-muted">(changed)</span> : null}
            </h2>
            <p className="text-sm text-muted">
                A static catalogue price always wins; without one a shop prices an item from its base price, the shop&apos;s tax
                and level, and for a unique item its enchantments. Shop types, levels and catalogues are on their own pages
                (World group).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FIELDS.map(field => {
                    const [min, max, whole] = SHOP_SETTINGS_LIMITS[field.key];
                    const id = `production-shops-${field.key}`;
                    return (
                        <div key={field.key}>
                            <label htmlFor={id} className="block text-sm font-medium text-fg mb-1">{field.label}</label>
                            <input
                                id={id}
                                type="number"
                                min={min}
                                max={max}
                                step={whole ? 1 : 'any'}
                                value={Number.isNaN(settings[field.key]) ? '' : settings[field.key]}
                                onChange={e => onChange({ ...settings, [field.key]: toNumber(e.target.value) })}
                                className="input px-3 py-2"
                            />
                            <p className="mt-1 text-xs text-muted">{field.help} {min} to {max}.</p>
                        </div>
                    );
                })}
            </div>
            {errors.length > 0 && (
                <ul className="list-disc pl-6 text-sm field-error" aria-label="Shop settings problems">
                    {errors.map(error => <li key={error}>{error}</li>)}
                </ul>
            )}
        </section>
    );
};

export default ShopSettingsCard;
