import React from 'react';
import { ProductionSettingsDto, TerritorySettingsDto } from '../../../types/dtos/territory/TerritoryDtos';
import { TERRITORY_LIMITS, rangeFormula, territorySettingsErrors } from '../../../utils/territory';

interface TerritorySettingsCardProps {
    value: ProductionSettingsDto;
    changed?: boolean;
    onChange: (value: ProductionSettingsDto) => void;
}

/** The power used in the card's example line. */
const EXAMPLE_POWER = 50;

/** A number from an input; empty or text becomes NaN, which the inline check reports and the API refuses. */
const toNumber = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw));

/**
 * Game settings section `production` (PandiO/knk-workspace#326 API, #690 web app): the production feature flag
 * (`Production:Enabled`, G16, off by default) and the territory range settings (territory DESIGN § 1, G11): range =
 * base range + power × factor, and a capital district's range is multiplied.
 */
export const TerritorySettingsCard: React.FC<TerritorySettingsCardProps> = ({ value, changed, onChange }) => {
    const territory = value.territory;
    const setTerritory = (patch: Partial<TerritorySettingsDto>) => onChange({ ...value, territory: { ...territory, ...patch } });
    const errors = territorySettingsErrors(territory);

    return (
        <section className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3" aria-labelledby="territory-settings-heading">
            <h2 id="territory-settings-heading" className="text-lg font-semibold text-fg">
                Production and territory{changed ? <span className="ml-2 text-xs font-normal text-muted">(changed)</span> : null}
            </h2>
            <p className="text-sm text-muted">
                A town's territory reaches its range from the nearest edge of each district's region; crown land uses its own
                range. The game server computes the territory from these numbers and rebuilds it when they change.
            </p>
            <label className="flex items-start gap-2 text-sm text-fg">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={value.enabled}
                    onChange={e => onChange({ ...value, enabled: e.target.checked })}
                />
                <span>
                    <span className="font-medium">Production enabled</span>
                    <span className="block text-xs text-muted">
                        <code>Production:Enabled</code>. Off (the default): the game server's territory report is refused and
                        nothing of the production feature runs. Admin pages work either way.
                    </span>
                </span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="territory-base-range" className="block text-sm font-medium text-fg mb-1">Base range (blocks)</label>
                    <input
                        id="territory-base-range"
                        type="number"
                        min={0}
                        max={TERRITORY_LIMITS.maxBaseRange}
                        value={Number.isNaN(territory.baseRange) ? '' : territory.baseRange}
                        onChange={e => setTerritory({ baseRange: toNumber(e.target.value) })}
                        className="input px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-muted">0 to {TERRITORY_LIMITS.maxBaseRange}.</p>
                </div>
                <div>
                    <label htmlFor="territory-power-factor" className="block text-sm font-medium text-fg mb-1">Blocks per power point</label>
                    <input
                        id="territory-power-factor"
                        type="number"
                        min={0}
                        max={TERRITORY_LIMITS.maxPowerFactor}
                        step="any"
                        value={Number.isNaN(territory.powerFactor) ? '' : territory.powerFactor}
                        onChange={e => setTerritory({ powerFactor: toNumber(e.target.value) })}
                        className="input px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-muted">The factor; 0 to {TERRITORY_LIMITS.maxPowerFactor}.</p>
                </div>
                <div>
                    <label htmlFor="territory-capital-multiplier" className="block text-sm font-medium text-fg mb-1">Capital multiplier</label>
                    <input
                        id="territory-capital-multiplier"
                        type="number"
                        min={TERRITORY_LIMITS.minCapitalMultiplier}
                        max={TERRITORY_LIMITS.maxCapitalMultiplier}
                        step="any"
                        value={Number.isNaN(territory.capitalMultiplier) ? '' : territory.capitalMultiplier}
                        onChange={e => setTerritory({ capitalMultiplier: toNumber(e.target.value) })}
                        className="input px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-muted">
                        {TERRITORY_LIMITS.minCapitalMultiplier} to {TERRITORY_LIMITS.maxCapitalMultiplier}; a capital district's range is multiplied.
                    </p>
                </div>
            </div>
            {errors.length > 0 ? (
                <ul className="text-sm field-error" role="alert" aria-label="Territory settings problems">
                    {errors.map(e => <li key={e}>{e}</li>)}
                </ul>
            ) : (
                <p className="text-sm text-fg" data-testid="territory-range-example">
                    A town of power {EXAMPLE_POWER}: {rangeFormula(territory, EXAMPLE_POWER)} blocks; its capital
                    {' '}{rangeFormula(territory, EXAMPLE_POWER, true)} blocks.
                </p>
            )}
        </section>
    );
};

export default TerritorySettingsCard;
