import React, { useCallback, useEffect, useState } from 'react';
import { CloudRain } from 'lucide-react';
import { weatherTypeClient } from '../../apiClients/weatherTypeClient';
import { useActionGate } from '../../hooks/useActionGate';
import {
    MODIFIER_EFFECTS,
    ProductionModifierEffect,
    RESOURCE_CATEGORIES,
    ResourceCategory,
    WeatherTypeDto,
} from '../../types/dtos/production/ProductionEngineDtos';
import { toast } from '../../utils/toast';
import { effectErrors, modifierStepLabel, PRODUCTION_WRITE_NODE, productionRefusalReason } from '../../utils/productionEngine';

interface Props {
    weatherTypeId: number;
    onChanged?: () => void;
    refreshKey?: number;
}

interface EffectRow {
    key: number;
    category: ResourceCategory;
    effect: ProductionModifierEffect;
    value: string;
}

let nextKey = 1;

const rowsOf = (dto: WeatherTypeDto): EffectRow[] => (dto.effects ?? []).map(effect => ({
    key: nextKey++,
    category: effect.category as ResourceCategory,
    effect: (effect.effect === 'Add' ? 'Add' : 'Multiply') as ProductionModifierEffect,
    value: String(effect.value),
}));

/**
 * A weather type's effects per resource category (PandiO/knk-workspace#678; PRODUCTION_KINDS § 4.3): on a day this
 * weather is rolled for a zone, the lines of that category in the zone's towns get these modifiers (an addition per
 * hour or a multiplication). Name and description are edited with the seeded form; the effects are not on it (G17) and
 * replace the stored ones when saved.
 */
export const WeatherTypeEffectsPanel: React.FC<Props> = ({ weatherTypeId, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [weatherType, setWeatherType] = useState<WeatherTypeDto | null>(null);
    const [rows, setRows] = useState<EffectRow[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const dto = await weatherTypeClient.getById(weatherTypeId);
            setWeatherType(dto);
            setRows(rowsOf(dto));
            setDirty(false);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the weather type.");
        }
    }, [weatherTypeId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const effects = rows.map(row => ({ category: row.category, effect: row.effect, value: Number(row.value) }));
    const problems = effectErrors(effects);
    const canEdit = gate.allowed && !saving;

    const change = (key: number, patch: Partial<EffectRow>) => {
        setRows(previous => previous.map(row => row.key === key ? { ...row, ...patch } : row));
        setDirty(true);
    };

    const save = async () => {
        if (!weatherType || problems.length > 0) return;
        setSaving(true);
        setSaveError(null);
        try {
            await weatherTypeClient.update({ id: weatherType.id, effects });
            toast.success('Effects saved.');
            await load();
            onChanged?.();
        } catch (err) {
            setSaveError(productionRefusalReason(err) ?? "Couldn't save the effects.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="weather-effects-heading" data-testid="weather-effects">
            <h2 id="weather-effects-heading" className="mb-1 flex items-center text-lg font-semibold text-fg">
                <CloudRain className="mr-2 h-5 w-5" aria-hidden="true" />
                Effects
            </h2>
            <p className="mb-4 text-sm text-muted">
                On a day with this weather, lines of a category get the effect: an addition per hour, or a multiplication
                (0.8 = 20% less).
            </p>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !weatherType && <p className="text-sm text-muted">Loading the weather type…</p>}
            {weatherType && (
                <>
                    {rows.length === 0 && <p className="mb-3 text-sm text-muted">No effects: this weather changes nothing.</p>}
                    <ul className="space-y-3" aria-label="Effects">
                        {rows.map((row, index) => (
                            <li key={row.key} className="grid grid-cols-1 gap-2 rounded border border-line p-3 sm:grid-cols-[1fr_1fr_8rem_6rem_auto] sm:items-end"
                                aria-label={`Effect ${index + 1}`}>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Category</span>
                                    <select className="input w-full px-2 py-2" value={row.category} disabled={!canEdit}
                                        onChange={e => change(row.key, { category: e.target.value as ResourceCategory })}>
                                        {RESOURCE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                                    </select>
                                </label>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Effect</span>
                                    <select className="input w-full px-2 py-2" value={row.effect} disabled={!canEdit}
                                        onChange={e => change(row.key, { effect: e.target.value as ProductionModifierEffect })}>
                                        {MODIFIER_EFFECTS.map(effect => <option key={effect} value={effect}>{effect === 'Add' ? 'Add per hour' : 'Multiply'}</option>)}
                                    </select>
                                </label>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Value</span>
                                    <input type="number" step="any" className="input w-full px-2 py-2" value={row.value} disabled={!canEdit}
                                        onChange={e => change(row.key, { value: e.target.value })} />
                                </label>
                                <span className="text-sm text-muted sm:pb-2">
                                    {row.value !== '' && Number.isFinite(Number(row.value)) ? modifierStepLabel({ effect: row.effect, value: Number(row.value) }) : ''}
                                </span>
                                <button type="button" className="btn-secondary text-sm" disabled={!canEdit}
                                    onClick={() => { setRows(previous => previous.filter(r => r.key !== row.key)); setDirty(true); }}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                    {problems.length > 0 && rows.length > 0 && (
                        <ul className="mt-3 list-disc pl-6 text-sm field-error" aria-label="Problems">
                            {problems.map(problem => <li key={problem}>{problem}</li>)}
                        </ul>
                    )}
                    {saveError && <p className="mt-3 text-sm field-error" role="alert">{saveError}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                            onClick={() => { setRows(previous => [...previous, { key: nextKey++, category: 'Crops', effect: 'Multiply', value: '1' }]); setDirty(true); }}>
                            Add effect
                        </button>
                        <button type="button" className="btn-primary text-sm" disabled={!canEdit || !dirty || problems.length > 0}
                            title={gate.hint ?? undefined} onClick={() => void save()}>
                            Save effects
                        </button>
                    </div>
                    {gate.hint && <p className="mt-3 text-xs text-muted">Editing: {gate.hint}.</p>}
                </>
            )}
        </section>
    );
};

export default WeatherTypeEffectsPanel;
