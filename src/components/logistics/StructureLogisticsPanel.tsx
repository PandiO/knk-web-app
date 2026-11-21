import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, PackageSearch } from 'lucide-react';
import { consumerReplenishmentClient } from '../../apiClients/consumerReplenishmentClient';
import { logisticsClient } from '../../apiClients/logisticsClient';
import { useActionGate } from '../../hooks/useActionGate';
import {
    ConsumerReplenishmentDto,
    ConsumerReplenishmentListDto,
    ConsumerViewDto,
    LOGISTICS_PRIORITY_CLASSES,
    LogisticsReservationListDto,
} from '../../types/dtos/production/LogisticsDtos';
import { formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { LOGISTICS_DELETE_NODE, LOGISTICS_NODE, SettingForm, emptySettingForm, logisticsSourceLabel, settingFormErrors } from '../../utils/logistics';
import { LookupPicker } from '../stock/LookupPicker';
import { LogisticsReservationTable } from './LogisticsReservationTable';
import { ReservationReleaseForm } from './ReservationReleaseForm';

interface Props {
    structureId: number;
    returnTo: string | null;
    refreshKey?: number;
}

/**
 * A structure as a consumer (PandiO/knk-workspace#686; TOWN_LOGISTICS § 3, § 5, acceptance A17): whether it consumes
 * (an Input or Merchandise storage), its own workers who collect (and the capacity one carries), the warehouse of its
 * service area, warnings; per storage and blueprint the stock with what is on the way against the min and max and where
 * they came from (its setting, a Replenishment rule, or the line inputs); the replenishment settings with add, edit,
 * switch off and delete; and its open reservations with Release. Shown to staff with the World area's node.
 */
export const StructureLogisticsPanel: React.FC<Props> = ({ structureId, returnTo, refreshKey }) => {
    const gate = useActionGate(LOGISTICS_NODE);
    const deleteGate = useActionGate(LOGISTICS_DELETE_NODE);
    const [view, setView] = useState<ConsumerViewDto | null>(null);
    const [settings, setSettings] = useState<ConsumerReplenishmentListDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<SettingForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [releasing, setReleasing] = useState<LogisticsReservationListDto | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setView(await logisticsClient.consumer(structureId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the structure's logistics.");
            return;
        }
        try {
            const page = await consumerReplenishmentClient.search({ pageNumber: 1, pageSize: 100, filters: { structureId: String(structureId) } });
            setSettings(page.items ?? []);
        } catch {
            setSettings(null);
        }
    }, [structureId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    if (!gate.allowed) return null;

    const edit = async (row: ConsumerReplenishmentListDto) => {
        setFormError(null);
        setNotice(null);
        try {
            const setting = await consumerReplenishmentClient.getById(row.id);
            setForm({
                id: row.id,
                storageId: String(setting.storageId ?? row.storageId),
                blueprint: { id: row.itemBlueprintId, label: row.itemBlueprintName ?? `#${row.itemBlueprintId}` },
                reorderPoint: String(setting.reorderPoint ?? row.reorderPoint),
                targetLevel: String(setting.targetLevel ?? row.targetLevel),
                priorityClass: setting.priorityClass ?? '',
                enabled: setting.enabled ?? row.enabled,
                note: setting.note ?? '',
            });
        } catch (err) {
            setFormError(productionRefusalReason(err) ?? "Couldn't load the setting.");
        }
    };

    const save = async () => {
        if (!form) return;
        setSaving(true);
        setFormError(null);
        const body: ConsumerReplenishmentDto = {
            id: form.id,
            storageId: Number(form.storageId),
            itemBlueprintId: form.blueprint?.id ?? null,
            reorderPoint: Number(form.reorderPoint),
            targetLevel: Number(form.targetLevel),
            priorityClass: form.priorityClass || null,
            enabled: form.enabled,
            note: form.note.trim() || null,
        };
        try {
            if (form.id != null) await consumerReplenishmentClient.update(body);
            else await consumerReplenishmentClient.create(body);
            setNotice(`Setting for ${form.blueprint?.label ?? 'the item'} saved.`);
            setForm(null);
            void load();
        } catch (err) {
            setFormError(productionRefusalReason(err) ?? "Couldn't save the setting.");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (row: ConsumerReplenishmentListDto) => {
        setFormError(null);
        try {
            await consumerReplenishmentClient.delete(row.id);
            setNotice(`Setting for ${row.itemBlueprintName ?? 'the item'} deleted: the min and max come from a rule or the line inputs again.`);
            void load();
        } catch (err) {
            setFormError(productionRefusalReason(err) ?? "Couldn't delete the setting.");
        }
    };

    const formProblems = form ? settingFormErrors(form) : [];

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-logistics-heading" data-testid="structure-logistics">
            <h2 id="structure-logistics-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <PackageSearch className="mr-2 h-5 w-5" aria-hidden="true" />
                Supply (as a consumer)
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !view && <p className="text-sm text-muted">Loading the supply…</p>}
            {notice && <p className="mb-3 text-sm text-fg" role="status">{notice}</p>}
            {view && !view.isConsumer && (
                <p className="text-sm text-muted" data-testid="structure-logistics-not-consumer">
                    Not a consumer: it has no Input or Merchandise storage, so the town's warehouses don't supply it. Add an Input storage to
                    give it replenishment settings.
                </p>
            )}
            {view && view.isConsumer && (
                <>
                    {view.warnings.length > 0 && (
                        <div className="mb-4 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
                            <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />Supply warnings</p>
                            <ul aria-label="Supply warnings" className="mt-1 list-disc pl-6">
                                {view.warnings.map(warning => <li key={warning}>{warning}</li>)}
                            </ul>
                        </div>
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Collected by</dt>
                            <dd data-testid="structure-logistics-workers">
                                {view.hasWorkers
                                    ? `Its own workers: ${view.workersPresent} of ${view.workersTotal} present, each carries up to ${formatNumber(view.carrierCapacity, 0)} units`
                                    : 'No workers: the planner can reserve but nobody collects'}
                            </dd></div>
                        <div><dt className="text-muted">Served by</dt>
                            <dd data-testid="structure-logistics-warehouse">
                                {view.serviceWarehouseId != null
                                    ? <><Link to={displayPath('Warehouse', view.serviceWarehouseId, returnTo)} className="text-primary hover:underline">{view.serviceWarehouseName ?? `#${view.serviceWarehouseId}`}</Link> ({logisticsSourceLabel(view.serviceSource)})</>
                                    : 'No warehouse in its town'}
                            </dd></div>
                        {view.townId != null && (
                            <div><dt className="text-muted">Town</dt>
                                <dd><Link to={displayPath('Town', view.townId, returnTo)} className="text-primary hover:underline">Town logistics and the planner</Link></dd></div>
                        )}
                    </dl>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Demand</h3>
                    {view.storages.map(storage => (
                        <div key={storage.storageId} className="mb-3">
                            <p className="text-sm font-medium">
                                <Link to={displayPath('Storage', storage.storageId, returnTo)} className="text-primary hover:underline">{storage.storageName ?? `Storage #${storage.storageId}`}</Link>
                                <span className="text-muted"> ({storage.purpose})</span>
                            </p>
                            {storage.lines.length === 0 ? <p className="text-sm text-muted">No min or max for any item yet.</p> : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-sm" aria-label={`Demand of ${storage.storageName ?? `storage #${storage.storageId}`}`}>
                                        <thead>
                                            <tr className="text-muted">
                                                <th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Stock</th>
                                                <th className="pr-4 font-medium">On the way</th><th className="pr-4 font-medium">Min</th>
                                                <th className="pr-4 font-medium">Max</th><th className="pr-4 font-medium">Priority</th>
                                                <th className="font-medium">Min and max from</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {storage.lines.map(line => (
                                                <tr key={line.itemBlueprintId} className={`border-t border-line ${line.stock + line.inbound <= line.reorderPoint ? 'text-warning-strong' : ''}`}>
                                                    <td className="pr-4 py-1">{line.itemBlueprintName ?? `#${line.itemBlueprintId}`}</td>
                                                    <td className="pr-4 py-1">{formatNumber(line.stock, 0)}</td>
                                                    <td className="pr-4 py-1">{formatNumber(line.inbound, 0)}</td>
                                                    <td className="pr-4 py-1">{formatNumber(line.reorderPoint, 0)}</td>
                                                    <td className="pr-4 py-1">{formatNumber(line.targetLevel, 0)}</td>
                                                    <td className="pr-4 py-1">{line.priorityClass}</td>
                                                    <td className="py-1">
                                                        {logisticsSourceLabel(line.settingSource)}
                                                        {line.ruleIds.length > 0 && ` (rules ${line.ruleIds.map(id => `#${id}`).join(', ')})`}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Replenishment settings</h3>
                    <p className="mb-2 text-xs text-muted">A setting wins over a Replenishment rule, which wins over the line inputs × 4 h / 12 h.</p>
                    {settings == null && <p className="text-sm text-muted">Couldn't load the settings.</p>}
                    {settings != null && settings.length === 0 && <p className="text-sm text-muted">No settings.</p>}
                    {settings != null && settings.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Replenishment settings">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Storage</th><th className="pr-4 font-medium">Item</th>
                                        <th className="pr-4 font-medium">Min</th><th className="pr-4 font-medium">Max</th>
                                        <th className="pr-4 font-medium">Priority</th><th className="pr-4 font-medium">On</th>
                                        <th className="font-medium"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {settings.map(row => (
                                        <tr key={row.id} className="border-t border-line">
                                            <td className="pr-4 py-1">{row.storageName ?? `#${row.storageId}`}</td>
                                            <td className="pr-4 py-1">{row.itemBlueprintName ?? `#${row.itemBlueprintId}`}</td>
                                            <td className="pr-4 py-1">{formatNumber(row.reorderPoint, 0)}</td>
                                            <td className="pr-4 py-1">{formatNumber(row.targetLevel, 0)}</td>
                                            <td className="pr-4 py-1">{row.priorityClass ?? 'From the policy'}</td>
                                            <td className="pr-4 py-1">{row.enabled ? 'Yes' : 'Off'}</td>
                                            <td className="py-1">
                                                <span className="flex gap-1">
                                                    <button type="button" className="btn-secondary text-xs" aria-label={`Edit the setting for ${row.itemBlueprintName ?? row.itemBlueprintId}`}
                                                        onClick={() => void edit(row)}>Edit</button>
                                                    <button type="button" className="btn-secondary text-xs" disabled={!deleteGate.allowed} title={deleteGate.hint ?? undefined}
                                                        aria-label={`Delete the setting for ${row.itemBlueprintName ?? row.itemBlueprintId}`} onClick={() => void remove(row)}>Delete</button>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!form && (
                        <button type="button" className="btn-secondary mt-2 text-sm" onClick={() => { setNotice(null); setForm(emptySettingForm(view.storages[0]?.storageId)); }}>
                            Add a setting
                        </button>
                    )}
                    {form && (
                        <div role="group" aria-label={form.id != null ? 'Edit the setting' : 'New setting'} className="mt-3 space-y-3 rounded border border-line p-3 text-sm">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div>
                                    <label htmlFor="replenishment-storage" className="mb-1 block font-medium text-fg">Storage</label>
                                    <select id="replenishment-storage" className="input px-3 py-2" value={form.storageId} disabled={form.id != null}
                                        onChange={e => setForm({ ...form, storageId: e.target.value })}>
                                        <option value="">Pick a storage</option>
                                        {view.storages.map(s => <option key={s.storageId} value={s.storageId}>{s.storageName ?? `#${s.storageId}`} ({s.purpose})</option>)}
                                    </select>
                                </div>
                                {form.id != null
                                    ? <div><span className="mb-1 block font-medium text-fg">Item</span><span>{form.blueprint?.label}</span></div>
                                    : <LookupPicker entityType="ItemBlueprint" label="Item" value={form.blueprint} onChange={blueprint => setForm({ ...form, blueprint })} />}
                                <div>
                                    <label htmlFor="replenishment-priority" className="mb-1 block font-medium text-fg">Priority class</label>
                                    <select id="replenishment-priority" className="input px-3 py-2" value={form.priorityClass} onChange={e => setForm({ ...form, priorityClass: e.target.value })}>
                                        <option value="">From the policy (else Normal)</option>
                                        {LOGISTICS_PRIORITY_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="replenishment-min" className="mb-1 block font-medium text-fg">Min (reorder point)</label>
                                    <input id="replenishment-min" type="number" min={0} step={1} className="input px-3 py-2" value={form.reorderPoint}
                                        onChange={e => setForm({ ...form, reorderPoint: e.target.value })} />
                                </div>
                                <div>
                                    <label htmlFor="replenishment-max" className="mb-1 block font-medium text-fg">Max (target level)</label>
                                    <input id="replenishment-max" type="number" min={1} step={1} className="input px-3 py-2" value={form.targetLevel}
                                        onChange={e => setForm({ ...form, targetLevel: e.target.value })} />
                                </div>
                                <label className="flex items-center gap-2 self-end pb-2">
                                    <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
                                    On (off: the planner ignores it)
                                </label>
                            </div>
                            <div>
                                <label htmlFor="replenishment-note" className="mb-1 block font-medium text-fg">Note</label>
                                <input id="replenishment-note" className="input w-full px-3 py-2" maxLength={200} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                            </div>
                            {formProblems.length > 0 && (
                                <ul aria-label="Setting problems" className="list-disc pl-6 field-error">
                                    {formProblems.map(problem => <li key={problem}>{problem}</li>)}
                                </ul>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="btn-primary text-sm" disabled={saving || formProblems.length > 0} onClick={() => void save()}>
                                    {saving ? 'Saving…' : 'Save the setting'}
                                </button>
                                <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => { setForm(null); setFormError(null); }}>Cancel</button>
                            </div>
                        </div>
                    )}
                    {formError && <p className="mt-2 text-sm field-error" role="alert">{formError}</p>}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Open reservations</h3>
                    <LogisticsReservationTable reservations={view.openReservations} returnTo={returnTo} label="Open reservations of this consumer"
                        empty="No open reservations." onRelease={reservation => setReleasing(reservation)} />
                    {releasing && (
                        <ReservationReleaseForm reservationId={releasing.id} onCancel={() => setReleasing(null)}
                            onReleased={released => {
                                setReleasing(null);
                                setNotice(`Reservation #${released.id} released.`);
                                void load();
                            }} />
                    )}
                </>
            )}
        </section>
    );
};

export default StructureLogisticsPanel;
