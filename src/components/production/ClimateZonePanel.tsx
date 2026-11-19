import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun } from 'lucide-react';
import { climateZoneClient } from '../../apiClients/climateZoneClient';
import { useActionGate } from '../../hooks/useActionGate';
import { ClimateZoneDto, WeatherRollDto } from '../../types/dtos/production/ProductionEngineDtos';
import { displayPath } from '../../utils/returnTo';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../utils/toast';
import { formatNumber, oddsErrors, oddsTotal, PRODUCTION_WRITE_NODE, productionRefusalReason } from '../../utils/productionEngine';
import { LookupPick, LookupPicker } from '../stock/LookupPicker';

interface Props {
    zoneId: number;
    returnTo: string | null;
    onChanged?: () => void;
    refreshKey?: number;
}

interface OddsRow {
    key: number;
    weatherType: LookupPick | null;
    chance: string;
}

let nextKey = 1;

const oddsRowsOf = (zone: ClimateZoneDto): OddsRow[] => (zone.weatherOdds ?? []).map(odd => ({
    key: nextKey++,
    weatherType: { id: odd.weatherTypeId, label: odd.weatherType?.name ?? odd.weatherTypeName ?? `Weather type #${odd.weatherTypeId}` },
    chance: String(odd.chancePercent),
}));

const townsOf = (zone: ClimateZoneDto): LookupPick[] => (zone.towns ?? []).map(town => ({
    id: town.townId,
    label: town.town?.name ?? town.townName ?? `Town #${town.townId}`,
}));

/** The rolls shown on the page (newest first). */
const ROLL_PAGE = 30;

/**
 * A climate zone's weather (PandiO/knk-workspace#678; PRODUCTION_KINDS § 4.3, IMPLEMENTATION_PLAN § P3): the odds of
 * each weather type (at most 100% together; the rest is clear weather), the towns in the zone (a town added here leaves
 * its previous zone; towns in no zone use the default zone) and the stored daily rolls. Name, description and "default
 * zone" are edited with the zone's seeded form; these lists are not on it (G17) and replace the stored ones when saved.
 */
export const ClimateZonePanel: React.FC<Props> = ({ zoneId, returnTo, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [zone, setZone] = useState<ClimateZoneDto | null>(null);
    const [odds, setOdds] = useState<OddsRow[]>([]);
    const [towns, setTowns] = useState<LookupPick[]>([]);
    const [newTown, setNewTown] = useState<LookupPick | null>(null);
    const [dirtyOdds, setDirtyOdds] = useState(false);
    const [dirtyTowns, setDirtyTowns] = useState(false);
    const [rolls, setRolls] = useState<WeatherRollDto[] | null>(null);
    const [rollTotal, setRollTotal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const dto = await climateZoneClient.getById(zoneId);
            setZone(dto);
            setOdds(oddsRowsOf(dto));
            setTowns(townsOf(dto));
            setDirtyOdds(false);
            setDirtyTowns(false);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the climate zone.");
            return;
        }
        try {
            const page = await climateZoneClient.searchRolls({ pageNumber: 1, pageSize: ROLL_PAGE, filters: { climateZoneId: String(zoneId) } });
            setRolls(page.items ?? []);
            setRollTotal(page.totalCount ?? 0);
        } catch {
            setRolls([]);
        }
    }, [zoneId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const oddsDto = odds.map(row => ({ weatherTypeId: row.weatherType?.id ?? 0, chancePercent: Number(row.chance) }));
    const problems = oddsErrors(oddsDto);
    const total = oddsTotal(oddsDto);
    const canEdit = gate.allowed && !busy;

    const changeOdds = (key: number, patch: Partial<OddsRow>) => {
        setOdds(previous => previous.map(row => row.key === key ? { ...row, ...patch } : row));
        setDirtyOdds(true);
    };

    const save = async (part: 'odds' | 'towns') => {
        if (!zone) return;
        setBusy(true);
        setSaveError(null);
        try {
            await climateZoneClient.update(part === 'odds'
                ? { id: zone.id, weatherOdds: oddsDto }
                : { id: zone.id, towns: towns.map(town => ({ townId: town.id })) });
            toast.success(part === 'odds' ? 'Weather odds saved.' : 'Towns saved.');
            await load();
            onChanged?.();
        } catch (err) {
            setSaveError(productionRefusalReason(err) ?? `Couldn't save the ${part === 'odds' ? 'weather odds' : 'towns'}.`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="climate-zone-heading" data-testid="climate-zone">
            <h2 id="climate-zone-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <CloudSun className="mr-2 h-5 w-5" aria-hidden="true" />
                Weather
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !zone && <p className="text-sm text-muted">Loading the climate zone…</p>}
            {zone && (
                <>
                    {zone.isDefault && (
                        <p className="mb-4 text-sm text-muted" data-testid="climate-zone-default">
                            The default zone: towns in no other zone use it.
                        </p>
                    )}
                    <h3 className="mb-1 text-base font-semibold text-fg">Odds per day</h3>
                    <p className="mb-3 text-sm text-muted">
                        The weather is rolled once per in-game day and stored. The chances add up to at most 100%; the rest
                        is clear weather.
                    </p>
                    <ul className="space-y-3" aria-label="Weather odds">
                        {odds.map((row, index) => (
                            <li key={row.key} className="grid grid-cols-1 gap-2 rounded border border-line p-3 sm:grid-cols-[2fr_8rem_auto] sm:items-end"
                                aria-label={`Weather ${index + 1}`}>
                                <LookupPicker entityType="WeatherType" label="Weather type" value={row.weatherType} disabled={!canEdit} required
                                    onChange={weatherType => changeOdds(row.key, { weatherType })} />
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Chance %</span>
                                    <input type="number" min={0} max={100} step="any" className="input w-full px-2 py-2" value={row.chance}
                                        disabled={!canEdit} onChange={e => changeOdds(row.key, { chance: e.target.value })} />
                                </label>
                                <button type="button" className="btn-secondary text-sm" disabled={!canEdit}
                                    onClick={() => { setOdds(previous => previous.filter(r => r.key !== row.key)); setDirtyOdds(true); }}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-sm text-fg" data-testid="climate-zone-clear">
                        {odds.length === 0
                            ? 'No weather types: always clear.'
                            : `Together ${formatNumber(total)}%; clear ${formatNumber(Math.max(0, 100 - total))}%.`}
                    </p>
                    {problems.length > 0 && odds.length > 0 && (
                        <ul className="mt-2 list-disc pl-6 text-sm field-error" aria-label="Problems">
                            {problems.map(problem => <li key={problem}>{problem}</li>)}
                        </ul>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                            onClick={() => { setOdds(previous => [...previous, { key: nextKey++, weatherType: null, chance: '' }]); setDirtyOdds(true); }}>
                            Add weather type
                        </button>
                        <button type="button" className="btn-primary text-sm" disabled={!canEdit || !dirtyOdds || problems.length > 0}
                            title={gate.hint ?? undefined} onClick={() => void save('odds')}>
                            Save odds
                        </button>
                    </div>

                    <h3 className="mt-6 mb-1 text-base font-semibold text-fg">Towns</h3>
                    <p className="mb-3 text-sm text-muted">A town added here leaves its previous zone.</p>
                    {towns.length === 0
                        ? <p className="mb-3 text-sm text-muted">No towns.</p>
                        : (
                            <ul className="mb-3 space-y-1" aria-label="Towns">
                                {towns.map(town => (
                                    <li key={town.id} className="flex items-center gap-2 text-sm">
                                        <Link to={displayPath('Town', town.id, returnTo)} className="text-primary hover:underline">{town.label}</Link>
                                        <button type="button" className="btn-secondary text-xs" disabled={!canEdit} aria-label={`Remove ${town.label}`}
                                            onClick={() => { setTowns(previous => previous.filter(t => t.id !== town.id)); setDirtyTowns(true); }}>
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_auto_auto] sm:items-end">
                        <LookupPicker entityType="Town" label="Town" value={newTown} disabled={!canEdit} onChange={setNewTown}
                            excludeIds={towns.map(town => town.id)} />
                        <button type="button" className="btn-secondary text-sm" disabled={!canEdit || !newTown}
                            onClick={() => {
                                if (newTown) setTowns(previous => previous.some(t => t.id === newTown.id) ? previous : [...previous, newTown]);
                                setNewTown(null);
                                setDirtyTowns(true);
                            }}>
                            Add town
                        </button>
                        <button type="button" className="btn-primary text-sm" disabled={!canEdit || !dirtyTowns}
                            title={gate.hint ?? undefined} onClick={() => void save('towns')}>
                            Save towns
                        </button>
                    </div>
                    {saveError && <p className="mt-3 text-sm field-error" role="alert">{saveError}</p>}
                    {gate.hint && <p className="mt-3 text-xs text-muted">Editing: {gate.hint}.</p>}

                    <h3 className="mt-6 mb-1 text-base font-semibold text-fg">Stored rolls</h3>
                    {rolls == null && <p className="text-sm text-muted">Loading the rolls…</p>}
                    {rolls != null && rolls.length === 0 && <p className="text-sm text-muted">No weather rolled yet.</p>}
                    {rolls != null && rolls.length > 0 && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm" aria-label="Weather rolls">
                                    <thead>
                                        <tr className="text-left text-muted">
                                            <th className="py-1 pr-4 font-medium">Day</th>
                                            <th className="py-1 pr-4 font-medium">From</th>
                                            <th className="py-1 pr-4 font-medium">Until</th>
                                            <th className="py-1 pr-4 font-medium">Weather</th>
                                            <th className="py-1 pr-4 font-medium">Roll</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rolls.map(roll => (
                                            <tr key={roll.id} className="border-t border-line">
                                                <td className="py-1 pr-4">{roll.day}</td>
                                                <td className="py-1 pr-4 whitespace-nowrap">{formatDateTime(roll.dayStartsAt)}</td>
                                                <td className="py-1 pr-4 whitespace-nowrap">{formatDateTime(roll.dayEndsAt)}</td>
                                                <td className="py-1 pr-4">{roll.weatherType?.name ?? roll.weatherTypeName}</td>
                                                <td className="py-1 pr-4">{formatNumber(roll.rollValue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {rollTotal > rolls.length && (
                                <p className="mt-2 text-xs text-muted">The newest {rolls.length} of {rollTotal} rolls.</p>
                            )}
                        </>
                    )}
                </>
            )}
        </section>
    );
};

export default ClimateZonePanel;
