import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Truck } from 'lucide-react';
import { transportOrderClient } from '../../apiClients/transportOrderClient';
import { useActionGate } from '../../hooks/useActionGate';
import { TransportOrderDto } from '../../types/dtos/production/TransportDtos';
import { formatDateTime } from '../../utils/format';
import { blueprintName, formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { toast } from '../../utils/toast';
import {
    TRANSPORT_WRITE_NODE,
    canCancelOrder,
    formatDistance,
    timelineOf,
    transportEventLabel,
    transportStatusIsProblem,
    transportStatusLabel,
} from '../../utils/transport';

interface Props {
    orderId: number;
    returnTo: string | null;
    refreshKey?: number;
    /** After a cancel, so the details above are read again. */
    onChanged?: () => void;
}

const ref = (entity: string, id: number | null | undefined, name: string | null | undefined, returnTo: string | null) =>
    id == null ? <>-</> : <Link to={displayPath(entity, id, returnTo)} className="text-primary hover:underline">{name ?? `#${id}`}</Link>;

/**
 * A transport order (PandiO/knk-workspace#682; production DESIGN § 7.1-7.3, § 11.1, acceptance A12): its status and why,
 * the source, carrier and times; the cargo per blueprint (requested, loaded, delivered, returned, lost) and what is on
 * the road now; the route as its stops with distance, where the distance came from, ETA and the amounts per stop; the
 * carriers; the event log as a timeline with the stock transaction of each move; and Cancel (before loading the order
 * ends Cancelled, after it the cargo goes back).
 */
export const TransportOrderPanel: React.FC<Props> = ({ orderId, returnTo, refreshKey, onChanged }) => {
    const writeGate = useActionGate(TRANSPORT_WRITE_NODE);
    const [order, setOrder] = useState<TransportOrderDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setOrder(await transportOrderClient.getById(orderId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the order.");
        }
    }, [orderId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const cancel = async () => {
        setBusy(true);
        setActionError(null);
        try {
            const updated = await transportOrderClient.cancel(orderId, { reason: reason.trim() || null });
            setOrder(updated);
            setConfirming(false);
            setReason('');
            toast.success(`Order #${orderId}: ${transportStatusLabel(updated.status).toLowerCase()}.`);
            onChanged?.();
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? 'The cancel was refused.');
        } finally {
            setBusy(false);
        }
    };

    const stopNames = new Map((order?.stops ?? []).map(stop => [stop.id, stop.storage?.name ?? `Storage #${stop.storageId}`]));

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="transport-order-heading" data-testid="transport-order">
            <h2 id="transport-order-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Truck className="mr-2 h-5 w-5" aria-hidden="true" />
                Transport
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !order && <p className="text-sm text-muted">Loading the order…</p>}
            {order && (
                <>
                    <p className={`text-base font-semibold ${transportStatusIsProblem(order.status) ? 'text-warning-strong' : 'text-fg'}`} data-testid="transport-status">
                        {transportStatusIsProblem(order.status) && <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                        {transportStatusLabel(order.status)}
                    </p>
                    {order.statusReason && <p className="text-sm text-muted" data-testid="transport-status-reason">{order.statusReason}</p>}
                    {order.cancelRequested && !order.isFinal && <p className="text-sm text-muted">A cancel was requested.</p>}

                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Origin</dt><dd>{order.origin}</dd></div>
                        <div><dt className="text-muted">From</dt><dd data-testid="transport-source">
                            {ref('Storage', order.sourceStorageId, order.sourceStorage?.name, returnTo)}
                            {order.sourceStructureId != null && <> at {ref('ProductionStructure', order.sourceStructureId, order.sourceStructure?.name, returnTo)}</>}
                        </dd></div>
                        <div><dt className="text-muted">Carried by</dt><dd data-testid="transport-carrier">
                            {order.carrierStructureId != null
                                ? <>A worker of {ref('ProductionStructure', order.carrierStructureId, order.carrierStructure?.name, returnTo)}</>
                                : 'A simulated carrier'}
                            {order.carrierCapacity != null ? `, up to ${formatNumber(order.carrierCapacity, 0)} units` : ''}
                        </dd></div>
                        <div><dt className="text-muted">Cargo storage (transit)</dt><dd>{ref('Storage', order.cargoStorageId, order.cargoStorage?.name, returnTo)}</dd></div>
                        <div><dt className="text-muted">Created</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
                        <div><dt className="text-muted">Runs after</dt><dd>{formatDateTime(order.executeAfter)}</dd></div>
                        <div><dt className="text-muted">Departed</dt><dd>{order.departedAt ? formatDateTime(order.departedAt) : '-'}</dd></div>
                        <div><dt className="text-muted">{order.completedAt ? 'Completed' : 'ETA'}</dt>
                            <dd data-testid="transport-eta">{order.completedAt ? formatDateTime(order.completedAt) : order.etaAt ? formatDateTime(order.etaAt) : '-'}</dd></div>
                        {order.waitingSince && <div><dt className="text-muted">Waiting since</dt><dd>{formatDateTime(order.waitingSince)}</dd></div>}
                        {order.reroutes > 0 && <div><dt className="text-muted">Re-routes</dt><dd>{order.reroutes}</dd></div>}
                        {order.note && <div className="sm:col-span-2"><dt className="text-muted">Note</dt><dd>{order.note}</dd></div>}
                    </dl>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Cargo</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm" aria-label="Cargo">
                            <thead>
                                <tr className="text-muted">
                                    <th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Requested</th><th className="pr-4 font-medium">Loaded</th>
                                    <th className="pr-4 font-medium">Delivered</th><th className="pr-4 font-medium">Returned</th><th className="font-medium">Lost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.lines.map(line => (
                                    <tr key={line.id} className="border-t border-line">
                                        <td className="pr-4 py-1">{blueprintName(line)}</td>
                                        <td className="pr-4 py-1">{formatNumber(line.requested, 0)}</td>
                                        <td className="pr-4 py-1">{formatNumber(line.loaded, 0)}</td>
                                        <td className="pr-4 py-1">{formatNumber(line.delivered, 0)}</td>
                                        <td className="pr-4 py-1">{formatNumber(line.returned, 0)}</td>
                                        <td className="py-1">{formatNumber(line.lost, 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-sm" data-testid="transport-in-transit">
                        <span className="text-muted">On the road now: </span>
                        {order.inTransit.length === 0 ? 'nothing' : order.inTransit.map(cargo => `${formatNumber(cargo.amount, 0)} × ${blueprintName(cargo)}`).join(', ')}
                    </p>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Route</h3>
                    <ol aria-label="Route" className="space-y-2 text-sm">
                        {[...order.stops].sort((a, b) => a.sequence - b.sequence).map(stop => (
                            <li key={stop.id} className={`rounded border p-3 ${stop.id === order.currentStopId ? 'border-primary' : 'border-line'}`}
                                aria-label={`Stop ${stop.sequence}: ${stop.storage?.name ?? `Storage #${stop.storageId}`}`}>
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-medium">
                                        {stop.sequence}. {ref('Storage', stop.storageId, stop.storage?.name, returnTo)}
                                        {stop.structureId != null && <span className="text-muted"> at {stop.structure?.name ?? `#${stop.structureId}`}</span>}
                                    </span>
                                    <span className="text-muted">{stop.status}{stop.id === order.currentStopId ? ' (current)' : ''}</span>
                                </div>
                                <p className="mt-1" data-testid={`stop-${stop.id}-distance`}>{formatDistance(stop.distanceBlocks, stop.distanceSource)}</p>
                                <p className="text-muted">
                                    {stop.arrivedAt ? `Arrived ${formatDateTime(stop.arrivedAt)}` : stop.etaAt ? `ETA ${formatDateTime(stop.etaAt)}` : 'Not on its way yet'}
                                    {stop.reroutedFromStopId != null ? `; re-routed from ${stopNames.get(stop.reroutedFromStopId) ?? `stop #${stop.reroutedFromStopId}`}` : ''}
                                    {stop.attempts > 1 ? `; ${stop.attempts} attempts` : ''}
                                </p>
                                {stop.lines.length > 0 && (
                                    <p className="mt-1">{stop.lines.map(line => `${formatNumber(line.delivered, 0)} of ${formatNumber(line.planned, 0)} ${blueprintName(line)}`).join(', ')}</p>
                                )}
                            </li>
                        ))}
                    </ol>

                    {order.assignments.length > 0 && (
                        <>
                            <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Carriers</h3>
                            <ul aria-label="Carriers" className="list-disc pl-6 text-sm">
                                {order.assignments.map(a => (
                                    <li key={a.id}>
                                        {a.mode}{a.carrierStructureId != null ? <>, {ref('ProductionStructure', a.carrierStructureId, a.carrierStructure?.name, returnTo)}</> : ''}:
                                        {' '}{a.workers} worker{a.workers === 1 ? '' : 's'}, {formatNumber(a.speedBlocksPerSecond, 3)} blocks/s
                                        {a.capacity != null ? `, ${formatNumber(a.capacity, 0)} units` : ''}; assigned {formatDateTime(a.assignedAt)}
                                        {a.releasedAt ? `, back ${formatDateTime(a.releasedAt)}` : ''}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Timeline</h3>
                    <ol aria-label="Timeline" className="space-y-2 border-l border-line pl-4 text-sm">
                        {timelineOf(order.events).map(event => (
                            <li key={event.id}>
                                <p>
                                    <span className="text-muted">{formatDateTime(event.at)}</span>{' '}
                                    <span className="font-medium">{transportEventLabel(event.kind)}</span>
                                    <span className="text-muted"> → {transportStatusLabel(event.statusAfter)}</span>
                                </p>
                                {event.message && <p>{event.message}</p>}
                                {(event.transportStopId != null || event.stockTransactionId != null) && (
                                    <p className="text-xs text-muted">
                                        {event.transportStopId != null ? `Stop: ${stopNames.get(event.transportStopId) ?? `#${event.transportStopId}`}` : ''}
                                        {event.transportStopId != null && event.stockTransactionId != null ? '; ' : ''}
                                        {event.stockTransactionId != null && (
                                            <Link to={displayPath('StockTransaction', event.stockTransactionId, returnTo)} className="text-primary hover:underline">
                                                transaction #{event.stockTransactionId}
                                            </Link>
                                        )}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>

                    {canCancelOrder(order) && (
                        <div className="mt-6 border-t border-line pt-4">
                            {!confirming ? (
                                <button type="button" className="btn-secondary text-sm" title={writeGate.hint ?? undefined}
                                    disabled={!writeGate.allowed || busy} onClick={() => setConfirming(true)}>
                                    Cancel the order
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm text-fg">
                                        {order.lines.some(line => line.loaded > 0)
                                            ? 'The cargo is loaded: the carrier turns back and the order ends Returned.'
                                            : 'Nothing is loaded yet: the order ends Cancelled.'}
                                    </p>
                                    <label className="block text-sm">
                                        <span className="mb-1 block font-medium text-fg">Reason (optional)</span>
                                        <input className="input w-full px-2 py-2" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} />
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void cancel()}>Cancel the order now</button>
                                        <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
                                    </div>
                                </div>
                            )}
                            {writeGate.hint && <p className="mt-2 text-xs text-muted">Cancelling: {writeGate.hint}.</p>}
                        </div>
                    )}
                    {actionError && <p className="mt-3 text-sm field-error" role="alert">{actionError}</p>}
                </>
            )}
        </section>
    );
};

export default TransportOrderPanel;
