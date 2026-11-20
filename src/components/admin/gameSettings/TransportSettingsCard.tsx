import React, { useState } from 'react';
import { transportOrderClient } from '../../../apiClients/transportOrderClient';
import { ProductionTransportSettingsDto, TransportSweepResultDto } from '../../../types/dtos/production/TransportDtos';
import { productionRefusalReason } from '../../../utils/productionEngine';
import { defaultTransportSettings, TRANSPORT_SETTINGS_LIMITS, transportSettingsErrors } from '../../../utils/transport';

interface Props {
    value: ProductionTransportSettingsDto | undefined;
    /** Whether production is enabled in the stored settings (Run transport now is refused while it is off). */
    enabled: boolean;
    changed?: boolean;
    onChange: (value: ProductionTransportSettingsDto) => void;
}

/** A number from an input; empty or text becomes NaN, which the inline check reports and the API refuses. */
const toNumber = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw));

const FIELDS: { key: keyof ProductionTransportSettingsDto; label: string; help: string }[] = [
    { key: 'walkingSpeedBlocksPerSecond', label: 'Walking speed (blocks/s)', help: 'A carrier\'s speed; 4.317 is a player\'s walk.' },
    { key: 'defaultCarrierCapacity', label: 'Carrier capacity (units)', help: 'What one worker carries when the level sets no capacity.' },
    { key: 'defaultThresholdPercent', label: 'Trigger threshold (%)', help: 'Output fill that sends an automatic order, without a structure threshold.' },
    { key: 'defaultThresholdUnits', label: 'Trigger for uncapped Output (units)', help: 'The same trigger for an Output storage without a cap.' },
    { key: 'unmeasuredRouteFactor', label: 'Unmeasured route factor', help: 'Straight distance × this when no lane is measured.' },
    { key: 'fallbackDistanceBlocks', label: 'Fallback distance (blocks)', help: 'A leg\'s length when neither a lane nor positions are known.' },
    { key: 'awaitingSpaceMinutes', label: 'Wait at a full stop (minutes)', help: 'Then the carrier re-routes or returns.' },
    { key: 'maxReroutes', label: 'Re-routes per order', help: 'After these the cargo goes back to the source.' },
    { key: 'laneMaxAgeHours', label: 'Lane max age (hours)', help: 'Older lanes are measured again by the game server.' },
];

/**
 * Game settings section `production.transport` (PandiO/knk-workspace#79 API, #682 web app; production DESIGN § 7):
 * speed, capacity, triggers, route estimates, waits and lane age, saved with the page's other sections, and "Run
 * transport now" (`POST api/TransportOrders/run-now`: one sweep over every open order and the automatic trigger),
 * refused while production is off (A21). The page is staff-only; a 403 shows the API's reason.
 */
export const TransportSettingsCard: React.FC<Props> = ({ value, enabled, changed, onChange }) => {
    const settings = value ?? defaultTransportSettings();
    const errors = transportSettingsErrors(settings);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<TransportSweepResultDto | null>(null);
    const [runError, setRunError] = useState<string | null>(null);

    const runNow = async () => {
        setRunning(true);
        setRunError(null);
        setResult(null);
        try {
            setResult(await transportOrderClient.runNow());
        } catch (err) {
            setRunError(productionRefusalReason(err) ?? "Couldn't run transport.");
        } finally {
            setRunning(false);
        }
    };

    return (
        <section className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3" aria-labelledby="production-transport-settings-heading">
            <h2 id="production-transport-settings-heading" className="text-lg font-semibold text-fg">
                Transport{changed ? <span className="ml-2 text-xs font-normal text-muted">(changed)</span> : null}
            </h2>
            <p className="text-sm text-muted">
                How simulated carriers move goods from producers to warehouses: a worker walks the route, carrying up to the
                capacity. Every minute the server moves the open orders on while production is enabled.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FIELDS.map(field => {
                    const [min, max, whole] = TRANSPORT_SETTINGS_LIMITS[field.key];
                    const id = `production-transport-${field.key}`;
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
                <ul className="list-disc pl-6 text-sm field-error" aria-label="Transport problems">
                    {errors.map(error => <li key={error}>{error}</li>)}
                </ul>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button type="button" className="btn-secondary text-sm" disabled={running || !enabled}
                    title={!enabled ? 'Production is off' : undefined} onClick={() => void runNow()}>
                    {running ? 'Running…' : 'Run transport now'}
                </button>
                <span className="text-xs text-muted">
                    {enabled ? 'Moves every open order on and runs the automatic trigger once.' : 'Production is off: no order moves (turn it on and save first).'}
                </span>
            </div>
            {result && (
                <p className="text-sm text-fg" role="status" data-testid="transport-run-result">
                    {result.ordersCreated} orders created, {result.ordersAdvanced} moved on{result.ordersFailed > 0 ? `, ${result.ordersFailed} failed` : ''}.
                </p>
            )}
            {runError && <p className="text-sm field-error" role="alert">{runError}</p>}
        </section>
    );
};

export default TransportSettingsCard;
