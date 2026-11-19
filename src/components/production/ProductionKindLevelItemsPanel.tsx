import React, { useCallback, useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { productionKindLevelClient } from '../../apiClients/productionKindLevelClient';
import { useActionGate } from '../../hooks/useActionGate';
import {
    LEVEL_ITEM_ROLES,
    ProductionKindLevelDto,
    ProductionKindLevelItemRole,
} from '../../types/dtos/production/ProductionEngineDtos';
import { toast } from '../../utils/toast';
import { blueprintName, levelItemErrors, PRODUCTION_WRITE_NODE, productionRefusalReason } from '../../utils/productionEngine';
import { LookupPick, LookupPicker } from '../stock/LookupPicker';

interface Props {
    levelId: number;
    /** After a save, so the details above are read again. */
    onChanged?: () => void;
    refreshKey?: number;
}

interface Row {
    key: number;
    role: ProductionKindLevelItemRole;
    blueprint: LookupPick | null;
    amount: string;
}

const ROLE_LABELS: Record<ProductionKindLevelItemRole, string> = {
    Unlock: 'Unlock (produced from this level on)',
    UpgradeCost: 'Upgrade cost (paid to reach this level)',
};

let nextKey = 1;

function rowsOf(level: ProductionKindLevelDto): Row[] {
    return (level.items ?? []).map(item => ({
        key: nextKey++,
        role: (item.role === 'Unlock' ? 'Unlock' : 'UpgradeCost') as ProductionKindLevelItemRole,
        blueprint: { id: item.itemBlueprintId, label: blueprintName(item) },
        amount: item.role === 'Unlock' ? '' : String(item.amount),
    }));
}

/**
 * The items of one production kind level (PandiO/knk-workspace#678; PRODUCTION_KINDS § 5, G8): the outputs unlocked
 * from this level on and the resources paid to upgrade to it. The level's own values (multipliers, caps, coins) are
 * edited with its seeded form; this list is not on that form (G17) and replaces the stored one when saved.
 */
export const ProductionKindLevelItemsPanel: React.FC<Props> = ({ levelId, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [level, setLevel] = useState<ProductionKindLevelDto | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const dto = await productionKindLevelClient.getById(levelId);
            setLevel(dto);
            setRows(rowsOf(dto));
            setDirty(false);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the level.");
        }
    }, [levelId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const change = (key: number, patch: Partial<Row>) => {
        setRows(previous => previous.map(row => row.key === key ? { ...row, ...patch } : row));
        setDirty(true);
    };

    const items = rows.map(row => ({
        role: row.role,
        itemBlueprintId: row.blueprint?.id ?? 0,
        amount: row.role === 'Unlock' ? 0 : Number(row.amount),
    }));
    const problems = levelItemErrors(items);
    const canEdit = gate.allowed && !saving;

    const save = async () => {
        if (!level || problems.length > 0) return;
        setSaving(true);
        setSaveError(null);
        try {
            await productionKindLevelClient.update({ ...level, productionKind: undefined, items });
            toast.success(`Level ${level.level} items saved.`);
            await load();
            onChanged?.();
        } catch (err) {
            setSaveError(productionRefusalReason(err) ?? "Couldn't save the items.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="level-items-heading" data-testid="level-items">
            <h2 id="level-items-heading" className="mb-1 flex items-center text-lg font-semibold text-fg">
                <ListChecks className="mr-2 h-5 w-5" aria-hidden="true" />
                Unlocks and upgrade cost
            </h2>
            <p className="mb-4 text-sm text-muted">
                An unlocked output is produced only from this level on. The upgrade cost is taken from a storage when a
                structure is upgraded to this level, together with the level's coins.
            </p>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !level && <p className="text-sm text-muted">Loading the level…</p>}
            {level && (
                <>
                    {rows.length === 0 && <p className="mb-3 text-sm text-muted">No unlocks and no upgrade cost.</p>}
                    <ul className="space-y-3" aria-label="Level items">
                        {rows.map((row, index) => (
                            <li key={row.key} className="grid grid-cols-1 gap-2 rounded border border-line p-3 sm:grid-cols-[1fr_2fr_8rem_auto] sm:items-end"
                                aria-label={`Item ${index + 1}`}>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Role</span>
                                    <select className="input w-full px-2 py-2" value={row.role} disabled={!canEdit}
                                        onChange={e => change(row.key, { role: e.target.value as ProductionKindLevelItemRole })}>
                                        {LEVEL_ITEM_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                                    </select>
                                </label>
                                <LookupPicker entityType="ItemBlueprint" label="Blueprint" value={row.blueprint} disabled={!canEdit} required
                                    onChange={blueprint => change(row.key, { blueprint })} />
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Amount</span>
                                    <input type="number" min={1} step={1} className="input w-full px-2 py-2" value={row.amount}
                                        disabled={!canEdit || row.role === 'Unlock'} placeholder={row.role === 'Unlock' ? '-' : ''}
                                        onChange={e => change(row.key, { amount: e.target.value })} />
                                </label>
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
                            onClick={() => { setRows(previous => [...previous, { key: nextKey++, role: 'UpgradeCost', blueprint: null, amount: '' }]); setDirty(true); }}>
                            Add item
                        </button>
                        <button type="button" className="btn-primary text-sm" disabled={!canEdit || !dirty || problems.length > 0}
                            title={gate.hint ?? undefined} onClick={() => void save()}>
                            {saving ? 'Saving…' : 'Save items'}
                        </button>
                        {dirty && (
                            <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => { setRows(rowsOf(level)); setDirty(false); }}>
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

export default ProductionKindLevelItemsPanel;
