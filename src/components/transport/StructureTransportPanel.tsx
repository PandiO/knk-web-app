import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Truck } from 'lucide-react';
import { productionStructureClient } from '../../apiClients/productionStructureClient';
import { transportLaneClient } from '../../apiClients/transportLaneClient';
import { useActionGate } from '../../hooks/useActionGate';
import { TransportLaneListDto, TransportStructureViewDto } from '../../types/dtos/production/TransportDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath, newFormPath, withReturnTo } from '../../utils/returnTo';
import { TRANSPORT_WRITE_NODE, formatUnits, newOrderPath, ordersPath } from '../../utils/transport';
import { TransportOrderTable } from './TransportOrderTable';
import { TransportPlanView } from './TransportPlanView';

interface Props {
    structureId: number;
    returnTo: string | null;
    refreshKey?: number;
}

/** The lanes shown on a structure page (newest measurement first). */
const LANE_PAGE_SIZE = 20;

/**
 * A production structure's transport (PandiO/knk-workspace#682; production DESIGN § 7.4, § 7.6, § 7.7, § 11.1,
 * acceptance A12, A13, insight #65): the warnings (no road connection D5, a full Output storage, no warehouse, no
 * workers); the automatic trigger's dry run (why it would fire or is held, the order it would make now and where it
 * would go); the Output fill against the threshold, the carrier capacity and the workers away; the open orders; the
 * lanes from and to the structure. Writes nothing; "New order from here" opens the manual order page.
 */
export const StructureTransportPanel: React.FC<Props> = ({ structureId, returnTo, refreshKey }) => {
    const writeGate = useActionGate(TRANSPORT_WRITE_NODE);
    const [view, setView] = useState<TransportStructureViewDto | null>(null);
    const [lanes, setLanes] = useState<TransportLaneListDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setView(await productionStructureClient.getTransport(structureId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the transport.");
            return;
        }
        try {
            const page = await transportLaneClient.search({ pageNumber: 1, pageSize: LANE_PAGE_SIZE, filters: { structureId: String(structureId) } });
            setLanes(page.items ?? []);
        } catch {
            setLanes(null);
        }
    }, [structureId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-transport-heading" data-testid="structure-transport">
            <h2 id="structure-transport-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Truck className="mr-2 h-5 w-5" aria-hidden="true" />
                Transport
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !view && <p className="text-sm text-muted">Loading the transport…</p>}
            {view && (
                <>
                    {view.warnings.length > 0 && (
                        <div className="mb-4 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
                            <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />Transport warnings</p>
                            <ul aria-label="Transport warnings" className="mt-1 list-disc pl-6">
                                {view.warnings.map(warning => <li key={warning}>{warning}</li>)}
                            </ul>
                        </div>
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Automatic transport</dt>
                            <dd data-testid="transport-automatic">
                                {!view.featureEnabled ? 'Off: production is turned off for the whole server' : view.automaticTransport ? 'On' : 'Off for this structure'}
                            </dd></div>
                        <div><dt className="text-muted">Road connection</dt>
                            <dd data-testid="transport-road">{view.isRural ? view.roadConnection : `${view.roadConnection} (in a district: the town's roads serve it)`}</dd></div>
                        <div><dt className="text-muted">Output</dt>
                            <dd data-testid="transport-output">
                                {view.outputStorageId != null
                                    ? <Link to={displayPath('Storage', view.outputStorageId, returnTo)} className="text-primary hover:underline">{formatUnits(view.outputUnits, view.outputMaxUnits)}</Link>
                                    : 'No Output storage'}
                            </dd></div>
                        <div><dt className="text-muted">Trigger at</dt><dd data-testid="transport-threshold">{formatNumber(view.threshold, 0)} units</dd></div>
                        <div><dt className="text-muted">A worker carries</dt><dd>{formatNumber(view.carrierCapacity, 0)} units</dd></div>
                        <div><dt className="text-muted">Workers</dt>
                            <dd data-testid="transport-workers">{view.workersPresent} of {view.workersTotal} present, {view.workersAway} away carrying</dd></div>
                        <div><dt className="text-muted">Goes to</dt>
                            <dd data-testid="transport-destination">
                                {view.destinationWarehouseId != null
                                    ? <Link to={displayPath('Warehouse', view.destinationWarehouseId, returnTo)} className="text-primary hover:underline">Warehouse #{view.destinationWarehouseId}</Link>
                                    : 'No warehouse found'}
                            </dd></div>
                    </dl>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Automatic trigger now</h3>
                    {view.triggerReasons.length > 0 && (
                        <ul aria-label="Why it would send an order" className="list-disc pl-6 text-sm">
                            {view.triggerReasons.map(reason => <li key={reason}>{reason}</li>)}
                        </ul>
                    )}
                    {view.heldReasons.length > 0 && (
                        <ul aria-label="Why no order is sent" className="list-disc pl-6 text-sm text-warning-strong">
                            {view.heldReasons.map(reason => <li key={reason}>{reason}</li>)}
                        </ul>
                    )}
                    {view.triggerReasons.length === 0 && view.heldReasons.length === 0 && (
                        <p className="text-sm text-muted">Below the trigger: no order is needed.</p>
                    )}
                    {view.wouldCreate && (
                        <div className="mt-3 rounded border border-line p-3">
                            <TransportPlanView plan={view.wouldCreate} label="The order the trigger would make" />
                        </div>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Open orders</h3>
                    <TransportOrderTable orders={view.openOrders} returnTo={returnTo} label="Open orders" empty="No open orders." />
                    <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                        <Link to={withReturnTo(ordersPath({ structureId: String(structureId) }), returnTo)} className="text-primary hover:underline">All orders of this structure</Link>
                        {writeGate.allowed && view.outputStorageId != null && (
                            <Link to={withReturnTo(newOrderPath(view.outputStorageId, structureId), returnTo)} className="text-primary hover:underline">New order from here</Link>
                        )}
                    </p>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Lanes</h3>
                    {lanes == null && <p className="text-sm text-muted">Couldn't load the lanes.</p>}
                    {lanes != null && lanes.length === 0 && <p className="text-sm text-muted">No measured lanes: legs use the straight distance × the route factor.</p>}
                    {lanes != null && lanes.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Lanes">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Lane</th><th className="pr-4 font-medium">Road</th>
                                        <th className="pr-4 font-medium">Straight</th><th className="pr-4 font-medium">Source</th><th className="font-medium">Measured</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lanes.map(lane => (
                                        <tr key={lane.id} className="border-t border-line">
                                            <td className="pr-4 py-1">
                                                <Link to={displayPath('TransportLane', lane.id, returnTo)} className="text-primary hover:underline">
                                                    {lane.fromStructureName ?? `#${lane.fromStructureId}`} → {lane.toStructureName ?? `#${lane.toStructureId}`}
                                                </Link>
                                            </td>
                                            <td className="pr-4 py-1">{!lane.reachable ? 'Unreachable' : lane.roadDistance != null ? `${formatNumber(lane.roadDistance, 1)} blocks` : '-'}</td>
                                            <td className="pr-4 py-1">{lane.straightDistance != null ? `${formatNumber(lane.straightDistance, 1)} blocks` : '-'}</td>
                                            <td className="pr-4 py-1">{lane.source}</td>
                                            <td className="py-1">{formatDateTime(lane.measuredAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {writeGate.allowed && (
                        <p className="mt-2 text-sm">
                            <Link to={newFormPath('TransportLane', returnTo)} className="text-primary hover:underline">Add a lane</Link>
                            <span className="text-muted"> (by hand; the game server measures them too)</span>
                        </p>
                    )}
                </>
            )}
        </section>
    );
};

export default StructureTransportPanel;
