import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Map as MapIcon } from 'lucide-react';
import { territoryClient } from '../../apiClients/territoryClient';
import { kingdomClient } from '../../apiClients/kingdomClient';
import { provinceClient } from '../../apiClients/provinceClient';
import { KingdomDto, ProvinceDto, TownTerritoryDto } from '../../types/dtos/territory/TerritoryDtos';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { displayPath } from '../../utils/returnTo';
import { toast } from '../../utils/toast';
import { TERRITORY_LIMITS, formatBlocks, parsePower } from '../../utils/territory';

/** The node every territory write needs (knk-web-api `StaffPermissions.ManageWorld`). */
export const TERRITORY_WRITE_NODES = ['knk.admin.world'];

interface Props {
    townId: number;
    townName: string;
    /** This page, so a kingdom's or district's page comes back here. */
    returnTo: string | null;
    /** Called after a save, so the details above re-read the town. */
    onChanged?: () => void;
}

interface Draft {
    power: string;
    kingdomId: string;
    provinceId: string;
}

const nameOf = (rows: { id?: number | null; name?: string | null }[], id: number | null | undefined): string | null =>
    id == null ? null : rows.find(r => r.id === id)?.name ?? `#${id}`;

/**
 * A town's territory (territory DESIGN § 1-2, G11; PandiO/knk-workspace#690): its power, kingdom and province, the
 * effective range of its normal and capital districts, and each district with its range. Staff with knk.admin.world
 * set the power, kingdom and province here and mark the capital district; the API recomputes the ranges and tells the
 * game server (`TerritoryChanged`).
 */
export const TownTerritoryPanel: React.FC<Props> = ({ townId, townName, returnTo, onChanged }) => {
    const writeGate = useAllNodesGate(TERRITORY_WRITE_NODES);
    const [territory, setTerritory] = useState<TownTerritoryDto | null>(null);
    const [kingdoms, setKingdoms] = useState<KingdomDto[]>([]);
    const [provinces, setProvinces] = useState<ProvinceDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [busyDistrict, setBusyDistrict] = useState<number | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [t, k, p] = await Promise.all([
                territoryClient.getTown(townId),
                kingdomClient.getAll().catch(() => [] as KingdomDto[]),
                provinceClient.getAll().catch(() => [] as ProvinceDto[]),
            ]);
            setTerritory(t);
            setKingdoms(k ?? []);
            setProvinces(p ?? []);
        } catch (err) {
            setError(apiRefusalReason(err) ?? "Couldn't load the town's territory.");
        }
    }, [townId]);

    useEffect(() => {
        setTerritory(null);
        setDraft(null);
        void load();
    }, [load]);

    const draftProvinces = useMemo(
        () => (draft?.kingdomId ? provinces.filter(p => String(p.kingdomId) === draft.kingdomId) : []),
        [draft?.kingdomId, provinces]
    );
    const draftPower = draft ? parsePower(draft.power) : null;

    const startEdit = () => {
        if (!territory) return;
        setDraft({
            power: String(territory.power),
            kingdomId: territory.kingdomId != null ? String(territory.kingdomId) : '',
            provinceId: territory.provinceId != null ? String(territory.provinceId) : '',
        });
    };

    const save = async () => {
        if (!draft || draftPower == null) return;
        setSaving(true);
        try {
            const kingdomId = draft.kingdomId ? Number(draft.kingdomId) : null;
            await territoryClient.saveTownTerritory(townId, {
                power: draftPower,
                kingdomId,
                provinceId: kingdomId != null && draft.provinceId ? Number(draft.provinceId) : null,
            });
            toast.success(`Territory of ${townName} saved.`);
            setDraft(null);
            await load();
            onChanged?.();
        } catch (err) {
            toast.error(apiRefusalReason(err) ?? `The territory of ${townName} could not be saved.`);
        } finally {
            setSaving(false);
        }
    };

    const toggleCapital = async (districtId: number, name: string, isCapital: boolean) => {
        setBusyDistrict(districtId);
        try {
            await territoryClient.setDistrictCapital(districtId, !isCapital);
            toast.success(isCapital ? `${name} is no longer a capital district.` : `${name} is now a capital district.`);
            await load();
            onChanged?.();
        } catch (err) {
            toast.error(apiRefusalReason(err) ?? `${name} could not be saved.`);
        } finally {
            setBusyDistrict(null);
        }
    };

    const kingdomName = nameOf(kingdoms, territory?.kingdomId);
    const provinceName = nameOf(provinces, territory?.provinceId);

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="town-territory-heading" data-testid="town-territory">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="town-territory-heading" className="flex items-center text-lg font-semibold text-fg">
                    <MapIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Territory
                </h2>
                {territory && !draft && (
                    <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={!writeGate.allowed}
                        title={writeGate.hint ?? undefined}
                        onClick={startEdit}
                    >
                        Edit territory
                    </button>
                )}
            </div>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !territory && <p className="text-sm text-muted">Loading the territory…</p>}
            {territory && !draft && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted">Power</dt><dd className="font-medium text-fg">{territory.power}</dd></div>
                    <div>
                        <dt className="text-muted">Kingdom</dt>
                        <dd className="font-medium text-fg">
                            {territory.kingdomId != null
                                ? <Link to={displayPath('Kingdom', territory.kingdomId, returnTo)} className="text-primary hover:underline">{kingdomName}</Link>
                                : 'None'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted">Province</dt>
                        <dd className="font-medium text-fg">
                            {territory.provinceId != null
                                ? <Link to={displayPath('Province', territory.provinceId, returnTo)} className="text-primary hover:underline">{provinceName}</Link>
                                : 'None'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted">Range</dt>
                        <dd className="font-medium text-fg" data-testid="town-range">
                            {formatBlocks(territory.range)} blocks; capital districts {formatBlocks(territory.capitalRange)} blocks
                        </dd>
                    </div>
                </dl>
            )}
            {territory && draft && (
                <form
                    className="space-y-3"
                    aria-label={`Territory of ${townName}`}
                    onSubmit={e => { e.preventDefault(); void save(); }}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label htmlFor="town-territory-power" className="mb-1 block text-sm font-medium text-fg">Power</label>
                            <input
                                id="town-territory-power"
                                type="number"
                                min={0}
                                max={TERRITORY_LIMITS.maxPower}
                                step={1}
                                className="input px-3 py-2"
                                value={draft.power}
                                onChange={e => setDraft({ ...draft, power: e.target.value })}
                                aria-invalid={draftPower == null}
                                aria-describedby="town-territory-power-hint"
                            />
                            <p id="town-territory-power-hint" className={`mt-1 text-xs ${draftPower == null ? 'field-error' : 'text-muted'}`}>
                                A whole number from 0 to {TERRITORY_LIMITS.maxPower.toLocaleString('en-GB')}. Range = base range + power × factor.
                            </p>
                        </div>
                        <div>
                            <label htmlFor="town-territory-kingdom" className="mb-1 block text-sm font-medium text-fg">Kingdom</label>
                            <select
                                id="town-territory-kingdom"
                                className="input px-3 py-2"
                                value={draft.kingdomId}
                                onChange={e => setDraft({ ...draft, kingdomId: e.target.value, provinceId: '' })}
                            >
                                <option value="">None</option>
                                {kingdoms.map(k => <option key={k.id ?? k.name} value={String(k.id)}>{k.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="town-territory-province" className="mb-1 block text-sm font-medium text-fg">Province</label>
                            <select
                                id="town-territory-province"
                                className="input px-3 py-2"
                                value={draft.provinceId}
                                disabled={!draft.kingdomId}
                                onChange={e => setDraft({ ...draft, provinceId: e.target.value })}
                            >
                                <option value="">None</option>
                                {draftProvinces.map(p => <option key={p.id ?? p.name} value={String(p.id)}>{p.name}</option>)}
                            </select>
                            <p className="mt-1 text-xs text-muted">Optional; only the provinces of the town's kingdom.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="btn-primary text-sm" disabled={saving || draftPower == null}>
                            {saving ? 'Saving…' : 'Save territory'}
                        </button>
                        <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => setDraft(null)}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}
            {territory && (
                <div className="mt-4">
                    <h3 className="mb-2 text-sm font-semibold text-fg">Districts</h3>
                    {territory.districts.length === 0 ? (
                        <p className="text-sm text-muted">{townName} has no districts, so it holds no territory.</p>
                    ) : (
                        <ul className="divide-y divide-line rounded-md border border-line" aria-label="District ranges">
                            {territory.districts.map(d => (
                                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                                    <span className="flex items-center gap-2">
                                        <Link to={displayPath('District', d.id, returnTo)} className="font-medium text-primary hover:underline">{d.name}</Link>
                                        {d.isCapital && (
                                            <span className="inline-flex items-center rounded bg-surface-alt px-1.5 text-xs text-fg">
                                                <Crown className="mr-1 h-3 w-3" aria-hidden="true" />Capital
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex items-center gap-3">
                                        <span className="text-muted">{formatBlocks(d.range)} blocks</span>
                                        <button
                                            type="button"
                                            className="btn-secondary text-xs"
                                            disabled={!writeGate.allowed || busyDistrict != null}
                                            title={writeGate.hint ?? undefined}
                                            onClick={() => void toggleCapital(d.id, d.name, d.isCapital)}
                                        >
                                            {d.isCapital ? `Unmark ${d.name} as capital` : `Make ${d.name} a capital`}
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-2 text-xs text-muted">
                        Distance is measured from the nearest edge of each district's region. The game server computes the territory
                        from these ranges; Game settings holds the base range, factor and capital multiplier.
                    </p>
                </div>
            )}
        </section>
    );
};

export default TownTerritoryPanel;
