import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { transportOrderClient } from '../../../apiClients/transportOrderClient';
import { storageClient } from '../../../apiClients/storageClient';
import { productionStructureClient } from '../../../apiClients/productionStructureClient';
import { LookupPick, LookupPicker } from '../../../components/stock/LookupPicker';
import { TransportPlanView } from '../../../components/transport/TransportPlanView';
import { useActionGate } from '../../../hooks/useActionGate';
import { TransportPlanDto } from '../../../types/dtos/production/TransportDtos';
import { productionRefusalReason } from '../../../utils/productionEngine';
import { displayPath, readReturnTo } from '../../../utils/returnTo';
import { newIdempotencyKey } from '../../../utils/stock';
import { toast } from '../../../utils/toast';
import {
    OrderForm,
    TRANSPORT_ORDERS_PATH,
    TRANSPORT_WRITE_NODE,
    orderFormErrors,
    toOrderRequest,
} from '../../../utils/transport';

interface LineDraft { key: number; blueprint: LookupPick | null; amount: string }
interface StopDraft { key: number; storage: LookupPick | null; lines: LineDraft[] }

let nextKey = 1;
const newLine = (): LineDraft => ({ key: nextKey++, blueprint: null, amount: '' });
const newStop = (): StopDraft => ({ key: nextKey++, storage: null, lines: [newLine()] });

/**
 * A manual transport order (PandiO/knk-workspace#682; production DESIGN § 7.4 "Manual and Quest", G17): the source
 * storage, an optional carrier (empty: a worker of the source's production structure, else a simulated carrier), the
 * stops in visiting order with the items to drop at each, an optional start time and note. "Dry run" asks the API what
 * the order would do (cargo against stock, legs with distances and times, room at each stop, warnings and errors)
 * without writing anything; "Make the order" is enabled after a dry run of the same request that can be made, and sends
 * that request with an idempotency key (a double click makes one order). The seeded TransportOrder form is read only, so
 * this page is the form. Needs knk.admin.world.
 */
export const TransportOrderNewPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const backTo = readReturnTo(searchParams) ?? TRANSPORT_ORDERS_PATH;
    const writeGate = useActionGate(TRANSPORT_WRITE_NODE);
    const [source, setSource] = useState<LookupPick | null>(null);
    const [carrier, setCarrier] = useState<LookupPick | null>(null);
    const [origin, setOrigin] = useState<OrderForm['origin']>('Manual');
    const [executeAfter, setExecuteAfter] = useState('');
    const [note, setNote] = useState('');
    const [stops, setStops] = useState<StopDraft[]>(() => [newStop()]);
    const [plan, setPlan] = useState<TransportPlanDto | null>(null);
    const [plannedFor, setPlannedFor] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const clientKey = useRef(newIdempotencyKey('web-transport'));

    // Filled from a structure page's "New order from here" (?sourceStorageId=&carrierStructureId=).
    useEffect(() => {
        const sourceId = Number(searchParams.get('sourceStorageId'));
        const carrierId = Number(searchParams.get('carrierStructureId'));
        if (sourceId > 0) {
            storageClient.getById(sourceId)
                .then(storage => setSource(current => current ?? { id: sourceId, label: storage.name ?? `Storage #${sourceId}` }))
                .catch(() => setSource(current => current ?? { id: sourceId, label: `Storage #${sourceId}` }));
        }
        if (carrierId > 0) {
            productionStructureClient.getById(carrierId)
                .then(structure => setCarrier(current => current ?? { id: carrierId, label: structure.name ?? `Structure #${carrierId}` }))
                .catch(() => setCarrier(current => current ?? { id: carrierId, label: `Structure #${carrierId}` }));
        }
        // Read once, on opening the page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const request = useMemo(() => toOrderRequest(
        { sourceStorageId: source?.id ?? null, carrierStructureId: carrier?.id ?? null, origin, executeAfter, note },
        stops.map(stop => ({ storageId: stop.storage?.id ?? null, lines: stop.lines.map(line => ({ blueprintId: line.blueprint?.id ?? null, amount: line.amount })) })),
    ), [source, carrier, origin, executeAfter, note, stops]);
    const requestKey = JSON.stringify(request);
    const problems = orderFormErrors(request);
    const planIsCurrent = plan != null && plannedFor === requestKey;

    const updateStop = (key: number, change: (stop: StopDraft) => StopDraft) =>
        setStops(current => current.map(stop => (stop.key === key ? change(stop) : stop)));
    const updateLine = (stopKey: number, lineKey: number, change: Partial<LineDraft>) =>
        updateStop(stopKey, stop => ({ ...stop, lines: stop.lines.map(line => (line.key === lineKey ? { ...line, ...change } : line)) }));

    const dryRun = async () => {
        setBusy(true);
        setActionError(null);
        try {
            const result = await transportOrderClient.dryRun(request);
            setPlan(result);
            setPlannedFor(requestKey);
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? 'The dry run was refused.');
        } finally {
            setBusy(false);
        }
    };

    const create = async () => {
        setBusy(true);
        setActionError(null);
        try {
            const order = await transportOrderClient.create({ ...request, clientKey: clientKey.current });
            toast.success(`Transport order #${order.id} made.`);
            clientKey.current = newIdempotencyKey('web-transport');
            navigate(displayPath('TransportOrder', order.id, TRANSPORT_ORDERS_PATH));
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? 'The order was refused.');
        } finally {
            setBusy(false);
        }
    };

    const disabled = !writeGate.allowed || busy;

    return (
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div>
                <h1 className="flex items-center text-2xl font-bold text-fg">
                    <Truck className="mr-2 h-6 w-6" aria-hidden="true" />
                    New transport order
                </h1>
                <p className="mt-1 text-sm text-muted">
                    Move goods from one storage to one or more stops. Run the dry run first: it shows what the order would do
                    without making it. <Link to={backTo} className="text-primary hover:underline">Back</Link>
                </p>
                {writeGate.hint && <p className="mt-2 text-sm field-error">Making orders: {writeGate.hint}.</p>}
            </div>

            <section className="panel space-y-4 p-4 sm:p-6" aria-label="Order">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <LookupPicker entityType="Storage" label="Source storage" value={source} onChange={setSource} disabled={disabled} required />
                    <LookupPicker entityType="ProductionStructure" label="Carrier (empty: the source's own worker)" value={carrier} onChange={setCarrier} disabled={disabled} />
                    <div>
                        <label htmlFor="order-origin" className="mb-1 block text-sm font-medium text-fg">Origin</label>
                        <select id="order-origin" className="input w-full px-3 py-2" value={origin} disabled={disabled}
                            onChange={e => setOrigin(e.target.value as OrderForm['origin'])}>
                            <option value="Manual">Manual</option>
                            <option value="Quest">Quest</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="order-execute-after" className="mb-1 block text-sm font-medium text-fg">Start after (empty: now)</label>
                        <input id="order-execute-after" type="datetime-local" className="input w-full px-3 py-2" value={executeAfter} disabled={disabled}
                            onChange={e => setExecuteAfter(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor="order-note" className="mb-1 block text-sm font-medium text-fg">Note</label>
                        <input id="order-note" className="input w-full px-3 py-2" value={note} maxLength={500} disabled={disabled} onChange={e => setNote(e.target.value)} />
                    </div>
                </div>

                <h2 className="text-base font-semibold text-fg">Stops, in visiting order</h2>
                <ol className="space-y-3">
                    {stops.map((stop, i) => (
                        <li key={stop.key} className="rounded border border-line p-3" aria-label={`Stop ${i + 1}`}>
                            <div className="flex flex-wrap items-end justify-between gap-2">
                                <div className="min-w-[16rem] flex-1">
                                    <LookupPicker entityType="Storage" label={`Stop ${i + 1} storage`} value={stop.storage} disabled={disabled} required
                                        excludeIds={source ? [source.id] : undefined}
                                        onChange={storage => updateStop(stop.key, s => ({ ...s, storage }))} />
                                </div>
                                {stops.length > 1 && (
                                    <button type="button" className="btn-secondary text-xs" disabled={disabled}
                                        onClick={() => setStops(current => current.filter(s => s.key !== stop.key))}>
                                        Remove stop {i + 1}
                                    </button>
                                )}
                            </div>
                            <ul className="mt-3 space-y-2">
                                {stop.lines.map((line, j) => (
                                    <li key={line.key} className="flex flex-wrap items-end gap-2">
                                        <div className="min-w-[14rem] flex-1">
                                            <LookupPicker entityType="ItemBlueprint" label={`Stop ${i + 1} item ${j + 1}`} value={line.blueprint} disabled={disabled} required
                                                onChange={blueprint => updateLine(stop.key, line.key, { blueprint })} />
                                        </div>
                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium text-fg">Stop {i + 1} amount {j + 1}</span>
                                            <input type="number" min={1} step={1} className="input w-28 px-2 py-2" value={line.amount} disabled={disabled}
                                                onChange={e => updateLine(stop.key, line.key, { amount: e.target.value })} />
                                        </label>
                                        {stop.lines.length > 1 && (
                                            <button type="button" className="btn-secondary text-xs" disabled={disabled}
                                                onClick={() => updateStop(stop.key, s => ({ ...s, lines: s.lines.filter(l => l.key !== line.key) }))}>
                                                Remove item {j + 1}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <button type="button" className="btn-secondary mt-2 text-xs" disabled={disabled}
                                onClick={() => updateStop(stop.key, s => ({ ...s, lines: [...s.lines, newLine()] }))}>
                                Add an item to stop {i + 1}
                            </button>
                        </li>
                    ))}
                </ol>
                <button type="button" className="btn-secondary text-sm" disabled={disabled} onClick={() => setStops(current => [...current, newStop()])}>
                    Add a stop
                </button>

                {problems.length > 0 && (
                    <ul aria-label="Order problems" className="list-disc pl-6 text-sm text-muted">
                        {problems.map(problem => <li key={problem}>{problem}</li>)}
                    </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <button type="button" className="btn-secondary text-sm" disabled={disabled || problems.length > 0} onClick={() => void dryRun()}>
                        Dry run
                    </button>
                    <button type="button" className="btn-primary text-sm" disabled={disabled || problems.length > 0 || !planIsCurrent || !plan?.valid}
                        onClick={() => void create()}>
                        Make the order
                    </button>
                    <span className="text-xs text-muted">
                        {!planIsCurrent ? 'Run the dry run for this order first.' : plan?.valid ? 'The plan below is what the order will do.' : 'Fix the errors below first.'}
                    </span>
                </div>
                {actionError && <p className="text-sm field-error" role="alert">{actionError}</p>}
            </section>

            {plan && (
                <section className="panel p-4 sm:p-6" aria-label="Dry run result">
                    <h2 className="mb-3 text-base font-semibold text-fg">Dry run{planIsCurrent ? '' : ' (of an earlier version of the order)'}</h2>
                    <TransportPlanView plan={plan} label="Dry run" />
                </section>
            )}
        </div>
    );
};

export default TransportOrderNewPage;
