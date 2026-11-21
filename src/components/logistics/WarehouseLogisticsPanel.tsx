import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { logisticsClient } from '../../apiClients/logisticsClient';
import { logisticsPolicyClient } from '../../apiClients/logisticsPolicyClient';
import { logisticsReservationClient } from '../../apiClients/logisticsReservationClient';
import { warehouseClient } from '../../apiClients/warehouseClient';
import { useActionGate } from '../../hooks/useActionGate';
import { LogisticsPolicyListDto, LogisticsReservationListDto, ServiceAreaEntryDto } from '../../types/dtos/production/LogisticsDtos';
import { productionRefusalReason } from '../../utils/productionEngine';
import { displayPath, newFormPath } from '../../utils/returnTo';
import { LOGISTICS_NODE } from '../../utils/logistics';
import { LogisticsReservationTable } from './LogisticsReservationTable';
import { ReservationReleaseForm } from './ReservationReleaseForm';
import { ServiceAreaTable } from './ServiceAreaTable';

interface Props {
    warehouseId: number;
    returnTo: string | null;
    refreshKey?: number;
}

/**
 * A warehouse's logistics (PandiO/knk-workspace#686; TOWN_LOGISTICS § 2, § 4, § 5.1): the districts, rural territory
 * and structures it serves (from a ServiceArea rule or as the nearest by road), its own warehouse policy (local reserves
 * and service areas) or a link to make one, and its open reservations with Release. Shown to staff with the World
 * area's node.
 */
export const WarehouseLogisticsPanel: React.FC<Props> = ({ warehouseId, returnTo, refreshKey }) => {
    const gate = useActionGate(LOGISTICS_NODE);
    const [townId, setTownId] = useState<number | null | undefined>(undefined);
    const [served, setServed] = useState<ServiceAreaEntryDto[] | null>(null);
    const [policy, setPolicy] = useState<LogisticsPolicyListDto | null | undefined>(undefined);
    const [reservations, setReservations] = useState<LogisticsReservationListDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [releasing, setReleasing] = useState<LogisticsReservationListDto | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        let town: number | null = null;
        try {
            const warehouse = await warehouseClient.getById(warehouseId);
            town = warehouse.effectiveTownId ?? warehouse.townId ?? null;
            setTownId(town);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the warehouse's logistics.");
            return;
        }
        if (town != null) {
            try {
                const areas = await logisticsClient.serviceAreas(town);
                setServed(areas.entries.filter(entry => entry.warehouseId === warehouseId));
            } catch {
                setServed(null);
            }
        }
        try {
            const page = await logisticsPolicyClient.search({ pageNumber: 1, pageSize: 1, filters: { scope: 'Warehouse', warehouseId: String(warehouseId) } });
            setPolicy(page.items?.[0] ?? null);
        } catch {
            setPolicy(undefined);
        }
        try {
            const page = await logisticsReservationClient.search({ pageNumber: 1, pageSize: 50, filters: { warehouseId: String(warehouseId), open: 'true' } });
            setReservations(page.items ?? []);
        } catch {
            setReservations(null);
        }
    }, [warehouseId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    if (!gate.allowed) return null;

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="warehouse-logistics-heading" data-testid="warehouse-logistics">
            <h2 id="warehouse-logistics-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Network className="mr-2 h-5 w-5" aria-hidden="true" />
                Logistics
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && townId === undefined && <p className="text-sm text-muted">Loading the warehouse's logistics…</p>}
            {notice && <p className="mb-3 text-sm text-fg" role="status">{notice}</p>}
            {!error && townId !== undefined && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Warehouse policy</dt>
                            <dd data-testid="warehouse-logistics-policy">
                                {policy === undefined && "Couldn't load the policy."}
                                {policy === null && <>None (the town's policy applies). <Link to={newFormPath('LogisticsPolicy', returnTo)} className="text-primary hover:underline">Make a warehouse policy</Link> for local reserves.</>}
                                {policy && <Link to={displayPath('LogisticsPolicy', policy.id, returnTo)} className="text-primary hover:underline">{policy.name} v{policy.version} ({policy.ruleCount} rules)</Link>}
                            </dd></div>
                        <div><dt className="text-muted">Town</dt>
                            <dd>{townId != null ? <Link to={displayPath('Town', townId, returnTo)} className="text-primary hover:underline">Town logistics and the planner</Link> : 'No town'}</dd></div>
                    </dl>
                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Serves</h3>
                    {townId == null && <p className="text-sm text-muted">Not in a town: it serves nobody.</p>}
                    {townId != null && served == null && <p className="text-sm text-muted">Couldn't load the service areas.</p>}
                    {served != null && served.length === 0 && <p className="text-sm text-muted">Nothing: other warehouses are nearer or named by a rule.</p>}
                    {served != null && served.length > 0 && <ServiceAreaTable entries={served} returnTo={returnTo} label="Served areas" />}
                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Open reservations</h3>
                    {reservations == null ? <p className="text-sm text-muted">Couldn't load the reservations.</p> : (
                        <LogisticsReservationTable reservations={reservations} returnTo={returnTo} label="Open reservations at this warehouse"
                            empty="No open reservations." onRelease={reservation => setReleasing(reservation)} />
                    )}
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

export default WarehouseLogisticsPanel;
