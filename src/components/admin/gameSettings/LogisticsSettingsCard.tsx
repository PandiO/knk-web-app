import React from 'react';
import { ProductionLogisticsSettingsDto } from '../../../types/dtos/production/LogisticsDtos';
import { LOGISTICS_SETTINGS_LIMITS, defaultLogisticsSettings, logisticsSettingsErrors } from '../../../utils/logistics';

interface Props {
    value: ProductionLogisticsSettingsDto | undefined;
    changed?: boolean;
    onChange: (value: ProductionLogisticsSettingsDto) => void;
}

/** A number from an input; empty or text becomes NaN, which the inline check reports and the API refuses. */
const toNumber = (raw: string): number => (raw.trim() === '' ? Number.NaN : Number(raw));

const FIELDS: { key: keyof ProductionLogisticsSettingsDto; label: string; help: string }[] = [
    { key: 'plannerIntervalMinutes', label: 'Planner interval (minutes)', help: 'How often each town is planned (D-L2: 10).' },
    { key: 'reservationMinutes', label: 'Reservation expiry (minutes)', help: 'A reservation not collected by then is released at the next run (F11).' },
    { key: 'consumptionWindowDays', label: 'Consumption window (days)', help: 'The days the flows and days of cover are averaged over.' },
    { key: 'defaultReorderHours', label: 'Default min (hours of input)', help: 'Without a setting or rule: the min is the line inputs × these hours.' },
    { key: 'defaultTargetHours', label: 'Default max (hours of input)', help: 'Without a setting or rule: the max is the line inputs × these hours.' },
    { key: 'runRetentionDays', label: 'Keep planner runs (days)', help: 'Older stored runs and their explanations are removed.' },
];

/**
 * Game settings section `production.logistics` (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS § 5): the
 * planner's interval, the reservation expiry, the consumption window and the default min and max in hours of input,
 * saved with the page's other sections. A town's planner is run from its page (Dry run, Run now).
 */
export const LogisticsSettingsCard: React.FC<Props> = ({ value, changed, onChange }) => {
    const settings = value ?? defaultLogisticsSettings();
    const errors = logisticsSettingsErrors(settings);

    return (
        <section className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3" aria-labelledby="production-logistics-settings-heading">
            <h2 id="production-logistics-settings-heading" className="text-lg font-semibold text-fg">
                Town logistics{changed ? <span className="ml-2 text-xs font-normal text-muted">(changed)</span> : null}
            </h2>
            <p className="text-sm text-muted">
                The planner reserves warehouse stock for consumers at or below their min, and their own worker collects it.
                It runs per town while production is enabled. Policies and templates are on the Town logistics page
                (World group); each town's plan, dry run and Run now are on the town's page.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FIELDS.map(field => {
                    const [min, max, whole] = LOGISTICS_SETTINGS_LIMITS[field.key];
                    const id = `production-logistics-${field.key}`;
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
                <ul className="list-disc pl-6 text-sm field-error" aria-label="Logistics problems">
                    {errors.map(error => <li key={error}>{error}</li>)}
                </ul>
            )}
        </section>
    );
};

export default LogisticsSettingsCard;
