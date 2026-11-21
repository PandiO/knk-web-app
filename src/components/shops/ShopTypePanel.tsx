import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Tags } from 'lucide-react';
import { shopTypeClient } from '../../apiClients/shopTypeClient';
import { shopTypeLevelClient } from '../../apiClients/shopTypeLevelClient';
import { useActionGate, useAllNodesGate } from '../../hooks/useActionGate';
import type { NamedRefDto } from '../../types/dtos/production/ProductionEngineDtos';
import type { ShopTypeDto, ShopTypeLevelDto } from '../../types/dtos/production/ShopDtos';
import { formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { LevelForm, SHOP_CHANGE_NODES, SHOP_DELETE_NODE, SHOP_NODE, levelBody, levelForm, levelFormErrors } from '../../utils/shops';
import { LookupPicker, LookupPick } from '../stock/LookupPicker';

interface Props {
    shopTypeId: number;
    returnTo: string | null;
    refreshKey?: number;
    onChanged?: () => void;
}

const LEVEL_FIELDS: { key: keyof LevelForm; label: string; hint?: string }[] = [
    { key: 'level', label: 'Level' },
    { key: 'cycleSpeedMultiplier', label: 'Cycle speed ×' },
    { key: 'yieldMultiplier', label: 'Yield ×' },
    { key: 'inputCostMultiplier', label: 'Input cost ×' },
    { key: 'priceMultiplier', label: 'Price ×' },
    { key: 'merchandiseMaxUnits', label: 'Merchandise cap', hint: 'units; empty: no cap' },
    { key: 'inputMaxUnits', label: 'Input cap', hint: 'units; empty: no cap' },
    { key: 'unitsPerSlot', label: 'Units per slot', hint: 'bound containers; empty: none' },
    { key: 'reorderPointUnits', label: 'Default min', hint: 'restock reorder point' },
    { key: 'targetUnits', label: 'Default max', hint: 'restock target level' },
];

const capText = (value: number | null | undefined) => (value ? formatNumber(value, 0) : '-');

/**
 * A shop type's accepted categories and levels (PandiO/knk-workspace#688; shops DESIGN § 3.2, § 5): the categories the
 * type buys from players (a category also accepts its sub-categories), saved as the whole `acceptedCategoryIds` list,
 * and its levels on the production level pattern (speed, yield, input cost, price multiplier, storage caps, the default
 * min/max) with add, edit and delete. A level's save applies to the type's shops at that level. World area only.
 */
export const ShopTypePanel: React.FC<Props> = ({ shopTypeId, returnTo, refreshKey, onChanged }) => {
    const gate = useActionGate(SHOP_NODE);
    const deleteGate = useActionGate(SHOP_DELETE_NODE);
    const changeGate = useAllNodesGate(SHOP_CHANGE_NODES);
    const [type, setType] = useState<ShopTypeDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<NamedRefDto[] | null>(null);
    const [picked, setPicked] = useState<LookupPick | null>(null);
    const [savingCategories, setSavingCategories] = useState(false);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [form, setForm] = useState<LevelForm | null>(null);
    const [savingLevel, setSavingLevel] = useState(false);
    const [levelError, setLevelError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const dto = await shopTypeClient.getById(shopTypeId);
            setType(dto);
            setCategories(dto.acceptedCategories ?? []);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the shop type.");
        }
    }, [shopTypeId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    if (!gate.allowed) return null;

    const stored = (type?.acceptedCategories ?? []).map(c => c.id).sort((a, b) => a - b);
    const current = (categories ?? []).map(c => c.id).sort((a, b) => a - b);
    const categoriesChanged = stored.join(',') !== current.join(',');

    const addCategory = (pick: LookupPick | null) => {
        if (!pick) return;
        setPicked(null);
        setCategories(previous => (previous ?? []).some(c => c.id === pick.id) ? previous : [...(previous ?? []), { id: pick.id, name: pick.label }]);
    };

    const saveCategories = async () => {
        setSavingCategories(true);
        setCategoryError(null);
        setNotice(null);
        try {
            const saved = await shopTypeClient.update({ id: shopTypeId, acceptedCategoryIds: current });
            setType(saved);
            setCategories(saved.acceptedCategories ?? []);
            setNotice(current.length === 0
                ? 'Accepted categories saved: the shop type buys nothing from players.'
                : `Accepted categories saved: ${(saved.acceptedCategories ?? []).map(c => c.name).join(', ')}.`);
            onChanged?.();
        } catch (err) {
            setCategoryError(productionRefusalReason(err) ?? "Couldn't save the accepted categories.");
        } finally {
            setSavingCategories(false);
        }
    };

    const levels = [...(type?.levels ?? [])].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const taken = levels.filter(l => l.id !== form?.id).map(l => l.level ?? 0);
    const nextLevel = levels.length === 0 ? 1 : Math.max(...levels.map(l => l.level ?? 0)) + 1;
    const levelProblems = form ? levelFormErrors(form, taken) : [];

    const saveLevel = async () => {
        if (!form) return;
        setSavingLevel(true);
        setLevelError(null);
        setNotice(null);
        try {
            const body = levelBody(form, shopTypeId);
            if (form.id != null) await shopTypeLevelClient.update(body);
            else await shopTypeLevelClient.create(body);
            setNotice(`Level ${form.level} saved; shops of this type at that level use it now.`);
            setForm(null);
            void load();
            onChanged?.();
        } catch (err) {
            setLevelError(productionRefusalReason(err) ?? "Couldn't save the level.");
        } finally {
            setSavingLevel(false);
        }
    };

    const removeLevel = async (level: ShopTypeLevelDto) => {
        setLevelError(null);
        setNotice(null);
        try {
            await shopTypeLevelClient.delete(level.id!);
            setNotice(`Level ${level.level} deleted.`);
            void load();
            onChanged?.();
        } catch (err) {
            setLevelError(productionRefusalReason(err) ?? "Couldn't delete the level.");
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="shop-type-heading" data-testid="shop-type-panel">
            <h2 id="shop-type-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Tags className="mr-2 h-5 w-5" aria-hidden="true" />
                Accepted categories and levels
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !type && <p className="text-sm text-muted">Loading the shop type…</p>}
            {notice && <p className="mb-3 text-sm text-fg" role="status">{notice}</p>}
            {type && (
                <>
                    <h3 className="mb-1 text-base font-semibold text-fg">Accepted categories</h3>
                    <p className="mb-2 text-xs text-muted">
                        What its shops buy from players; a category also accepts its sub-categories. Items outside them are refused with a reason.
                    </p>
                    {categories != null && categories.length === 0 && (
                        <p className="text-sm text-muted" data-testid="shop-type-no-categories">None: its shops buy nothing from players.</p>
                    )}
                    {categories != null && categories.length > 0 && (
                        <ul aria-label="Accepted categories" className="mb-2 flex flex-wrap gap-2">
                            {categories.map(category => (
                                <li key={category.id} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-sm">
                                    <Link to={displayPath('Category', category.id, returnTo)} className="text-primary hover:underline">{category.name}</Link>
                                    <button type="button" className="btn-secondary px-1 text-xs" aria-label={`Remove ${category.name}`}
                                        disabled={!changeGate.allowed} title={changeGate.hint ?? undefined}
                                        onClick={() => setCategories(previous => (previous ?? []).filter(c => c.id !== category.id))}>×</button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="max-w-sm">
                        <LookupPicker entityType="Category" label="Add a category" value={picked} onChange={addCategory}
                            excludeIds={current} disabled={!changeGate.allowed} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="btn-primary text-sm" disabled={!changeGate.allowed || !categoriesChanged || savingCategories}
                            title={changeGate.hint ?? undefined} onClick={() => void saveCategories()}>
                            {savingCategories ? 'Saving…' : 'Save the categories'}
                        </button>
                        {categoriesChanged && (
                            <button type="button" className="btn-secondary text-sm" disabled={savingCategories}
                                onClick={() => setCategories(type.acceptedCategories ?? [])}>Undo</button>
                        )}
                    </div>
                    {categoryError && <p className="mt-2 text-sm field-error" role="alert">{categoryError}</p>}

                    <h3 className="mt-6 mb-1 flex items-center text-base font-semibold text-fg">
                        <Layers className="mr-2 h-4 w-4" aria-hidden="true" />
                        Levels
                    </h3>
                    <p className="mb-2 text-xs text-muted">
                        As production levels: the multipliers, the storage caps of its shops and the default min and max the planner restocks to.
                        A shop's level picks its row.
                    </p>
                    {levels.length === 0 && <p className="text-sm text-muted" data-testid="shop-type-no-levels">No levels yet: its shops use × 1 and no caps.</p>}
                    {levels.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Levels">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Level</th><th className="pr-4 font-medium">Speed</th>
                                        <th className="pr-4 font-medium">Yield</th><th className="pr-4 font-medium">Input cost</th>
                                        <th className="pr-4 font-medium">Price</th><th className="pr-4 font-medium">Merchandise cap</th>
                                        <th className="pr-4 font-medium">Input cap</th><th className="pr-4 font-medium">Per slot</th>
                                        <th className="pr-4 font-medium">Min / max</th>
                                        <th className="font-medium"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {levels.map(level => (
                                        <tr key={level.id} className="border-t border-line">
                                            <td className="pr-4 py-1">
                                                <Link to={displayPath('ShopTypeLevel', level.id!, returnTo)} className="text-primary hover:underline">Level {level.level}</Link>
                                            </td>
                                            <td className="pr-4 py-1">× {formatNumber(level.cycleSpeedMultiplier, 3)}</td>
                                            <td className="pr-4 py-1">× {formatNumber(level.yieldMultiplier, 3)}</td>
                                            <td className="pr-4 py-1">× {formatNumber(level.inputCostMultiplier, 3)}</td>
                                            <td className="pr-4 py-1">× {formatNumber(level.priceMultiplier, 3)}</td>
                                            <td className="pr-4 py-1">{capText(level.merchandiseMaxUnits)}</td>
                                            <td className="pr-4 py-1">{capText(level.inputMaxUnits)}</td>
                                            <td className="pr-4 py-1">{capText(level.unitsPerSlot)}</td>
                                            <td className="pr-4 py-1">{capText(level.reorderPointUnits)} / {capText(level.targetUnits)}</td>
                                            <td className="py-1">
                                                <span className="flex gap-1">
                                                    <button type="button" className="btn-secondary text-xs" aria-label={`Edit level ${level.level}`}
                                                        disabled={!changeGate.allowed} title={changeGate.hint ?? undefined}
                                                        onClick={() => { setNotice(null); setLevelError(null); setForm(levelForm(level)); }}>Edit</button>
                                                    <button type="button" className="btn-secondary text-xs" disabled={!deleteGate.allowed} title={deleteGate.hint ?? undefined}
                                                        aria-label={`Delete level ${level.level}`} onClick={() => void removeLevel(level)}>Delete</button>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!form && (
                        <button type="button" className="btn-secondary mt-2 text-sm" disabled={!changeGate.allowed} title={changeGate.hint ?? undefined}
                            onClick={() => { setNotice(null); setLevelError(null); setForm(levelForm(null, nextLevel)); }}>
                            Add a level
                        </button>
                    )}
                    {form && (
                        <div role="group" aria-label={form.id != null ? `Edit level ${type.levels?.find(l => l.id === form.id)?.level ?? form.level}` : 'New level'}
                            className="mt-3 space-y-3 rounded border border-line p-3 text-sm">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
                                {LEVEL_FIELDS.map(field => (
                                    <div key={field.key}>
                                        <label htmlFor={`shop-level-${field.key}`} className="mb-1 block font-medium text-fg">{field.label}</label>
                                        <input id={`shop-level-${field.key}`} type="number" min={0} step="any" className="input w-full px-3 py-2"
                                            value={form[field.key] as string} aria-describedby={field.hint ? `shop-level-${field.key}-hint` : undefined}
                                            onChange={e => setForm({ ...form, [field.key]: e.target.value })} />
                                        {field.hint && <span id={`shop-level-${field.key}-hint`} className="text-xs text-muted">{field.hint}</span>}
                                    </div>
                                ))}
                            </div>
                            {levelProblems.length > 0 && (
                                <ul aria-label="Level problems" className="list-disc pl-6 field-error">
                                    {levelProblems.map(problem => <li key={problem}>{problem}</li>)}
                                </ul>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="btn-primary text-sm" disabled={savingLevel || levelProblems.length > 0} onClick={() => void saveLevel()}>
                                    {savingLevel ? 'Saving…' : 'Save the level'}
                                </button>
                                <button type="button" className="btn-secondary text-sm" disabled={savingLevel} onClick={() => { setForm(null); setLevelError(null); }}>Cancel</button>
                            </div>
                        </div>
                    )}
                    {levelError && <p className="mt-2 text-sm field-error" role="alert">{levelError}</p>}
                </>
            )}
        </section>
    );
};

export default ShopTypePanel;
