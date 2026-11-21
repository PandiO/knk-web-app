import React, { useState } from 'react';
import { shopCatalogueEntryClient } from '../../apiClients/shopCatalogueEntryClient';
import { useActionGate, useAllNodesGate } from '../../hooks/useActionGate';
import { SHOP_STOCK_MODES, ShopCatalogueEntryListDto, ShopStockMode } from '../../types/dtos/production/ShopDtos';
import { productionRefusalReason } from '../../utils/productionEngine';
import {
    CatalogueForm,
    SHOP_CHANGE_NODES,
    SHOP_DELETE_NODE,
    catalogueBody,
    catalogueFormErrors,
    emptyCatalogueForm,
    formatCoins,
    stockModeLabel,
} from '../../utils/shops';
import { LookupPicker } from '../stock/LookupPicker';

interface Props {
    shopId: number;
    /** The shop's entries (null: they couldn't be read). */
    entries: ShopCatalogueEntryListDto[] | null;
    onChanged: (notice: string) => void;
}

const entryName = (entry: ShopCatalogueEntryListDto) =>
    `${entry.itemBlueprintName ?? `#${entry.itemBlueprintId}`}${entry.itemInstanceId != null ? ` (item #${entry.itemInstanceId})` : ''}`;

/**
 * A shop's static catalogue (PandiO/knk-workspace#688; shops DESIGN § 2.3, § 4, § 7): per entry the item (a blueprint or
 * one unique item), the static price that wins over the formula, Stocked or Unlimited, the admin pin, the order and On,
 * with add, edit and delete. An entry keeps its item: to change it, delete the entry and add another.
 */
export const ShopCatalogueEditor: React.FC<Props> = ({ shopId, entries, onChanged }) => {
    const deleteGate = useActionGate(SHOP_DELETE_NODE);
    const changeGate = useAllNodesGate(SHOP_CHANGE_NODES);
    const [form, setForm] = useState<CatalogueForm | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const problems = form ? catalogueFormErrors(form) : [];
    const rows = [...(entries ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder || a.id - b.id);

    const edit = (entry: ShopCatalogueEntryListDto) => {
        setError(null);
        setEditing(entryName(entry));
        setForm({
            id: entry.id,
            blueprint: { id: entry.itemBlueprintId, label: entry.itemBlueprintName ?? `#${entry.itemBlueprintId}` },
            itemInstanceId: entry.itemInstanceId != null ? String(entry.itemInstanceId) : '',
            staticPrice: entry.staticPrice != null ? String(entry.staticPrice) : '',
            stockMode: entry.stockMode,
            pinned: entry.pinned,
            sortOrder: String(entry.sortOrder),
            enabled: entry.enabled,
        });
    };

    const save = async () => {
        if (!form) return;
        setSaving(true);
        setError(null);
        try {
            const body = catalogueBody(form, shopId);
            const saved = form.id != null ? await shopCatalogueEntryClient.update(body) : await shopCatalogueEntryClient.create(body);
            const name = saved.itemBlueprint?.name ?? form.blueprint?.label ?? (saved.itemInstanceId != null ? `item #${saved.itemInstanceId}` : 'the item');
            setForm(null);
            setEditing(null);
            onChanged(`Catalogue entry for ${name} saved.`);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't save the catalogue entry.");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (entry: ShopCatalogueEntryListDto) => {
        setError(null);
        try {
            await shopCatalogueEntryClient.delete(entry.id);
            onChanged(`Catalogue entry for ${entryName(entry)} deleted.`);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't delete the catalogue entry.");
        }
    };

    const isNew = form?.id == null;

    return (
        <div data-testid="shop-catalogue">
            <h3 className="mt-6 mb-1 text-base font-semibold text-fg">Catalogue</h3>
            <p className="mb-2 text-xs text-muted">
                A static price always wins; without one the shop sells at the blueprint's mid base price × its tax × its level's price
                multiplier. Unlimited entries are never sold out (the admin catalogue before the supply chain). Pinned entries come first.
            </p>
            {entries == null && <p className="text-sm text-muted">Couldn't load the catalogue.</p>}
            {entries != null && rows.length === 0 && <p className="text-sm text-muted">No catalogue entries.</p>}
            {rows.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm" aria-label="Catalogue">
                        <thead>
                            <tr className="text-muted">
                                <th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Static price</th>
                                <th className="pr-4 font-medium">Stock</th><th className="pr-4 font-medium">Pinned</th>
                                <th className="pr-4 font-medium">Order</th><th className="pr-4 font-medium">On</th>
                                <th className="font-medium"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(entry => (
                                <tr key={entry.id} className={`border-t border-line ${entry.enabled ? '' : 'text-muted'}`}>
                                    <td className="pr-4 py-1">{entryName(entry)}</td>
                                    <td className="pr-4 py-1">{entry.staticPrice != null ? formatCoins(entry.staticPrice) : 'Formula'}</td>
                                    <td className="pr-4 py-1">{entry.stockMode}</td>
                                    <td className="pr-4 py-1">{entry.pinned ? 'Pinned' : '-'}</td>
                                    <td className="pr-4 py-1">{entry.sortOrder}</td>
                                    <td className="pr-4 py-1">{entry.enabled ? 'Yes' : 'Off'}</td>
                                    <td className="py-1">
                                        <span className="flex gap-1">
                                            <button type="button" className="btn-secondary text-xs" aria-label={`Edit the entry for ${entryName(entry)}`}
                                                disabled={!changeGate.allowed} title={changeGate.hint ?? undefined}
                                                onClick={() => edit(entry)}>Edit</button>
                                            <button type="button" className="btn-secondary text-xs" disabled={!deleteGate.allowed} title={deleteGate.hint ?? undefined}
                                                aria-label={`Delete the entry for ${entryName(entry)}`} onClick={() => void remove(entry)}>Delete</button>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {!form && entries != null && (
                <button type="button" className="btn-secondary mt-2 text-sm" disabled={!changeGate.allowed} title={changeGate.hint ?? undefined}
                    onClick={() => { setError(null); setEditing(null); setForm(emptyCatalogueForm()); }}>
                    Add an entry
                </button>
            )}
            {form && (
                <div role="group" aria-label={isNew ? 'New catalogue entry' : `Edit the entry for ${editing}`} className="mt-3 space-y-3 rounded border border-line p-3 text-sm">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {isNew ? (
                            <>
                                <LookupPicker entityType="ItemBlueprint" label="Item" value={form.blueprint} onChange={blueprint => setForm({ ...form, blueprint })} />
                                <div>
                                    <label htmlFor="shop-entry-instance" className="mb-1 block font-medium text-fg">Or one unique item (instance id)</label>
                                    <input id="shop-entry-instance" inputMode="numeric" className="input w-full px-3 py-2" value={form.itemInstanceId}
                                        onChange={e => setForm({ ...form, itemInstanceId: e.target.value })} />
                                </div>
                            </>
                        ) : (
                            <div><span className="mb-1 block font-medium text-fg">Item</span><span>{editing}</span></div>
                        )}
                        <div>
                            <label htmlFor="shop-entry-price" className="mb-1 block font-medium text-fg">Static price (coins)</label>
                            <input id="shop-entry-price" type="number" min={0} step={1} className="input w-full px-3 py-2" value={form.staticPrice}
                                placeholder="Empty: the formula price" onChange={e => setForm({ ...form, staticPrice: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="shop-entry-mode" className="mb-1 block font-medium text-fg">Stock</label>
                            <select id="shop-entry-mode" className="input px-3 py-2" value={form.stockMode}
                                onChange={e => setForm({ ...form, stockMode: e.target.value as ShopStockMode })}>
                                {SHOP_STOCK_MODES.map(mode => <option key={mode} value={mode}>{stockModeLabel(mode)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="shop-entry-order" className="mb-1 block font-medium text-fg">Order</label>
                            <input id="shop-entry-order" type="number" step={1} className="input w-full px-3 py-2" value={form.sortOrder}
                                onChange={e => setForm({ ...form, sortOrder: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 self-end pb-2">
                            <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} />
                            Pinned (shown first, on display stalls too)
                        </label>
                        <label className="flex items-center gap-2 self-end pb-2">
                            <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
                            On (off: not offered)
                        </label>
                    </div>
                    {problems.length > 0 && (
                        <ul aria-label="Catalogue entry problems" className="list-disc pl-6 field-error">
                            {problems.map(problem => <li key={problem}>{problem}</li>)}
                        </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-primary text-sm" disabled={saving || problems.length > 0} onClick={() => void save()}>
                            {saving ? 'Saving…' : 'Save the entry'}
                        </button>
                        <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => { setForm(null); setError(null); }}>Cancel</button>
                    </div>
                </div>
            )}
            {error && <p className="mt-2 text-sm field-error" role="alert">{error}</p>}
        </div>
    );
};

export default ShopCatalogueEditor;
