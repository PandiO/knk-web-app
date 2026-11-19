import React, { useState } from 'react';
import { productionClient } from '../../../apiClients/productionClient';
import { ProductionEngineSettingsDto, ProductionSweepResultDto } from '../../../types/dtos/production/ProductionEngineDtos';
import {
    defaultProductionEngineSettings,
    PRODUCTION_ENGINE_LIMITS,
    productionEngineSettingsErrors,
    productionRefusalReason,
} from '../../../utils/productionEngine';

interface Props {
    value: ProductionEngineSettingsDto | undefined;
    /** Whether production is enabled in the stored settings (run-now is refused while it is off). */
    enabled: boolean;
    changed?: boolean;
    onChange: (value: ProductionEngineSettingsDto) => void;
}

/** A number from an input; empty or text becomes NaN, which the inline check reports and the API refuses. */
const toNumber = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw));

const FIELDS: { key: keyof ProductionEngineSettingsDto; label: string; help: string }[] = [
    { key: 'baseCycleMinutes', label: 'Base cycle (minutes)', help: 'A line settles every base cycle ÷ its level\'s cycle speed.' },
    { key: 'catchUpCapHours', label: 'Catch-up cap (hours)', help: 'A settle after a long pause accrues at most this much.' },
    { key: 'weatherDayMinutes', label: 'Weather day (minutes)', help: 'The weather is rolled once per day of this length; 20 = a vanilla day.' },
];

/**
 * Game settings section `production.engine` (PandiO/knk-workspace#86 API, #678 web app; PRODUCTION_KINDS § 4.3-4.4):
 * the engine's timing, saved with the page's other sections, and "Run production now" (`POST api/Production/run-now`:
 * roll today's weather and settle every line), refused while production is off (A21). The page is staff-only; the API
 * answers 403 to staff without knk.admin.world, and the card shows that reason.
 */
export const ProductionEngineSettingsCard: React.FC<Props> = ({ value, enabled, changed, onChange }) => {
    const settings = value ?? defaultProductionEngineSettings();
    const errors = productionEngineSettingsErrors(settings);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<ProductionSweepResultDto | null>(null);
    const [runError, setRunError] = useState<string | null>(null);

    const runNow = async () => {
        setRunning(true);
        setRunError(null);
        setResult(null);
        try {
            setResult(await productionClient.runNow());
        } catch (err) {
            setRunError(productionRefusalReason(err) ?? "Couldn't run production.");
        } finally {
            setRunning(false);
        }
    };

    return (
        <section className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3" aria-labelledby="production-engine-settings-heading">
            <h2 id="production-engine-settings-heading" className="text-lg font-semibold text-fg">
                Production engine{changed ? <span className="ml-2 text-xs font-normal text-muted">(changed)</span> : null}
            </h2>
            <p className="text-sm text-muted">
                How often production lines settle and how the weather days run. Every 60 seconds the server settles the lines
                that are due while production is enabled.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FIELDS.map(field => {
                    const [min, max] = PRODUCTION_ENGINE_LIMITS[field.key];
                    const id = `production-engine-${field.key}`;
                    return (
                        <div key={field.key}>
                            <label htmlFor={id} className="block text-sm font-medium text-fg mb-1">{field.label}</label>
                            <input
                                id={id}
                                type="number"
                                min={min}
                                max={max}
                                step={1}
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
                <ul className="list-disc pl-6 text-sm field-error" aria-label="Production engine problems">
                    {errors.map(error => <li key={error}>{error}</li>)}
                </ul>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button type="button" className="btn-secondary text-sm" disabled={running || !enabled}
                    title={!enabled ? 'Production is off' : undefined} onClick={() => void runNow()}>
                    {running ? 'Running…' : 'Run production now'}
                </button>
                <span className="text-xs text-muted">
                    {enabled ? 'Rolls today\'s weather and settles every line up to now.' : 'Production is off: nothing runs (turn it on and save first).'}
                </span>
            </div>
            {result && (
                <p className="text-sm text-fg" role="status" data-testid="production-run-result">
                    {result.linesSettled} lines settled, {result.unitsAccepted} of {result.unitsEmitted} units accepted,
                    {' '}{result.weatherRolled} weather rolls{result.linesFailed > 0 ? `, ${result.linesFailed} lines failed` : ''}.
                </p>
            )}
            {runError && <p className="text-sm field-error" role="alert">{runError}</p>}
        </section>
    );
};

export default ProductionEngineSettingsCard;
