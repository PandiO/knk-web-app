import React, { useCallback, useEffect, useState } from 'react';
import { Table2 } from 'lucide-react';
import { productionKindClient } from '../../apiClients/productionKindClient';
import { useActionGate } from '../../hooks/useActionGate';
import type { ProductionKindDto } from '../../types/dtos/production/ProductionEngineDtos';
import { PRODUCTION_WRITE_NODE, productionRefusalReason } from '../../utils/productionEngine';
import { primaryOutputErrors, yieldRowErrors } from '../../utils/productionYield';
import { toast } from '../../utils/toast';
import { LookupPick, LookupPicker } from '../stock/LookupPicker';

interface Props {
    kindId: number;
    onChanged?: () => void;
    refreshKey?: number;
}

interface Row {
    key: number;
    unitKey: string;
    blueprint: LookupPick | null;
    rate: string;
    chance: string;
    minLevel: string;
}

interface Primary {
    key: number;
    blueprint: LookupPick | null;
}

let nextKey = 1;

const nameOf = (id: number, ref?: { name?: string | null } | null) => ref?.name ?? `Blueprint #${id}`;

function rowsOf(kind: ProductionKindDto): Row[] {
    return (kind.yieldTable ?? []).map(row => ({
        key: nextKey++,
        unitKey: row.unitKey ?? '',
        blueprint: { id: row.itemBlueprintId, label: nameOf(row.itemBlueprintId, row.itemBlueprint) },
        rate: String(row.ratePerUnitPerHour),
        chance: String(row.byproductChance ?? 1),
        minLevel: String(row.minLevel ?? 1),
    }));
}

function primariesOf(kind: ProductionKindDto): Primary[] {
    return (kind.primaryOutputs ?? []).map(p => ({ key: nextKey++, blueprint: { id: p.itemBlueprintId, label: nameOf(p.itemBlueprintId, p.itemBlueprint) } }));
}

/**
 * A production kind's yield table and primary outputs (PandiO/knk-workspace#680; PRODUCTION_KINDS § 4.1-4.2): which
 * survey unit (or prefix such as `TREE:OAK:*`) yields which blueprint at what rate per unit per hour, with a byproduct
 * chance and the level it unlocks at, and the outputs that get the kind's primary multiplier. The survey profile and
 * the multiplier are on the kind's seeded form; these two lists are not (G17) and each replaces the stored list when
 * saved. A save makes the lines of every Derived and Hybrid structure of the kind again.
 */
export const ProductionKindYieldTablePanel: React.FC<Props> = ({ kindId, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [kind, setKind] = useState<ProductionKindDto | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [primaries, setPrimaries] = useState<Primary[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const dto = await productionKindClient.getById(kindId);
            setKind(dto);
            setRows(rowsOf(dto));
            setPrimaries(primariesOf(dto));
            setDirty(false);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the kind.");
        }
    }, [kindId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const yieldTable = rows.map(row => ({
        unitKey: row.unitKey.trim().toUpperCase(),
        itemBlueprintId: row.blueprint?.id ?? 0,
        ratePerUnitPerHour: row.rate.trim() === '' ? NaN : Number(row.rate),
        byproductChance: row.chance.trim() === '' ? 1 : Number(row.chance),
        minLevel: row.minLevel.trim() === '' ? 1 : Number(row.minLevel),
    }));
    const primaryOutputs = primaries.map(p => ({ itemBlueprintId: p.blueprint?.id ?? 0 }));
    const problems = [...yieldRowErrors(yieldTable), ...primaryOutputErrors(primaryOutputs)];
    const canEdit = gate.allowed && !saving;

    const change = (key: number, patch: Partial<Row>) => {
        setRows(previous => previous.map(row => row.key === key ? { ...row, ...patch } : row));
        setDirty(true);
    };

    const save = async () => {
        if (!kind || problems.length > 0) return;
        setSaving(true);
        setSaveError(null);
        try {
            // Only the two lists: the API keeps every null field (the L10 child-list pattern).
            await productionKindClient.update({ id: kind.id, yieldTable, primaryOutputs });
            toast.success(`${kind.name ?? 'Kind'}: yield table saved.`);
            await load();
            onChanged?.();
        } catch (err) {
            setSaveError(productionRefusalReason(err) ?? "Couldn't save the yield table.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="kind-yield-heading" data-testid="kind-yield-table">
            <h2 id="kind-yield-heading" className="mb-1 flex items-center text-lg font-semibold text-fg">
                <Table2 className="mr-2 h-5 w-5" aria-hidden="true" />
                Yield table
            </h2>
            <p className="mb-4 text-sm text-muted">
                Each surveyed unit yields its output at the rate per unit per hour times the chance (a chance below 1 is a
                byproduct). The most specific row wins: an exact key before a prefix ending in ":*". Units no row matches
                yield nothing.
            </p>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !kind && <p className="text-sm text-muted">Loading the kind…</p>}
            {kind && (
                <>
                    <p className="mb-3 text-sm text-muted" data-testid="survey-profile">
                        Survey profile v{kind.surveyProfileVersion ?? 0}, primary multiplier × {kind.primaryMultiplier ?? 1.5} (both on the kind's form).
                    </p>
                    {rows.length === 0 && <p className="mb-3 text-sm text-muted">No rows: Derived and Hybrid structures of this kind yield nothing yet.</p>}
                    <ul className="space-y-3" aria-label="Yield rows">
                        {rows.map((row, index) => (
                            <li key={row.key} className="grid grid-cols-1 gap-2 rounded border border-line p-3 sm:grid-cols-[12rem_2fr_7rem_6rem_6rem_auto] sm:items-end"
                                aria-label={`Yield row ${index + 1}`}>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Unit key</span>
                                    <input className="input w-full px-2 py-2 font-mono" value={row.unitKey} disabled={!canEdit} placeholder="TREE:OAK:*"
                                        onChange={e => change(row.key, { unitKey: e.target.value })} />
                                </label>
                                <LookupPicker entityType="ItemBlueprint" label="Output" value={row.blueprint} disabled={!canEdit} required
                                    onChange={blueprint => change(row.key, { blueprint })} />
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Rate per unit/h</span>
                                    <input type="number" min={0} step="any" className="input w-full px-2 py-2" value={row.rate} disabled={!canEdit}
                                        onChange={e => change(row.key, { rate: e.target.value })} />
                                </label>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Chance</span>
                                    <input type="number" min={0} max={1} step="any" className="input w-full px-2 py-2" value={row.chance} disabled={!canEdit}
                                        onChange={e => change(row.key, { chance: e.target.value })} />
                                </label>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">From level</span>
                                    <input type="number" min={1} max={10} step={1} className="input w-full px-2 py-2" value={row.minLevel} disabled={!canEdit}
                                        onChange={e => change(row.key, { minLevel: e.target.value })} />
                                </label>
                                <button type="button" className="btn-secondary text-sm" disabled={!canEdit}
                                    onClick={() => { setRows(previous => previous.filter(r => r.key !== row.key)); setDirty(true); }}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button type="button" className="btn-secondary mt-3 text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                        onClick={() => { setRows(previous => [...previous, { key: nextKey++, unitKey: '', blueprint: null, rate: '', chance: '1', minLevel: '1' }]); setDirty(true); }}>
                        Add row
                    </button>

                    <h3 className="mb-2 mt-5 text-base font-semibold text-fg">Primary outputs</h3>
                    <p className="mb-2 text-sm text-muted">These outputs get the primary multiplier on Derived and Hybrid lines (a mine's ore, not its stone).</p>
                    {primaries.length === 0 && <p className="mb-2 text-sm text-muted">None.</p>}
                    <ul className="space-y-2" aria-label="Primary outputs">
                        {primaries.map((p, index) => (
                            <li key={p.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_auto] sm:items-end" aria-label={`Primary output ${index + 1}`}>
                                <LookupPicker entityType="ItemBlueprint" label="Blueprint" value={p.blueprint} disabled={!canEdit} required
                                    onChange={blueprint => { setPrimaries(previous => previous.map(x => x.key === p.key ? { ...x, blueprint } : x)); setDirty(true); }} />
                                <button type="button" className="btn-secondary text-sm" disabled={!canEdit}
                                    onClick={() => { setPrimaries(previous => previous.filter(x => x.key !== p.key)); setDirty(true); }}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button type="button" className="btn-secondary mt-2 text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                        onClick={() => { setPrimaries(previous => [...previous, { key: nextKey++, blueprint: null }]); setDirty(true); }}>
                        Add primary output
                    </button>

                    {problems.length > 0 && (rows.length > 0 || primaries.length > 0) && (
                        <ul className="mt-3 list-disc pl-6 text-sm field-error" aria-label="Problems">
                            {problems.map(problem => <li key={problem}>{problem}</li>)}
                        </ul>
                    )}
                    {saveError && <p className="mt-3 text-sm field-error" role="alert">{saveError}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="btn-primary text-sm" disabled={!canEdit || !dirty || problems.length > 0}
                            title={gate.hint ?? undefined} onClick={() => void save()}>
                            {saving ? 'Saving…' : 'Save yield table'}
                        </button>
                        {dirty && (
                            <button type="button" className="btn-secondary text-sm" disabled={saving}
                                onClick={() => { setRows(rowsOf(kind)); setPrimaries(primariesOf(kind)); setDirty(false); }}>
                                Undo changes
                            </button>
                        )}
                    </div>
                    {gate.hint && <p className="mt-3 text-xs text-muted">Editing: {gate.hint}.</p>}
                </>
            )}
        </section>
    );
};

export default ProductionKindYieldTablePanel;
