import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { logisticsReservationClient } from '../../apiClients/logisticsReservationClient';
import { useActionGate } from '../../hooks/useActionGate';
import { LogisticsReservationDto } from '../../types/dtos/production/LogisticsDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { transportStatusLabel } from '../../utils/transport';
import { LOGISTICS_NODE, reservationStatusLabel } from '../../utils/logistics';
import { ReservationReleaseForm } from './ReservationReleaseForm';

interface Props {
    reservationId: number;
    returnTo: string | null;
    refreshKey?: number;
    onChanged?: () => void;
}

/**
 * A reservation (PandiO/knk-workspace#686; TOWN_LOGISTICS § 5.1): what is held where for whom, collected of reserved,
 * the status and its reason, the expiry, the collection order and the run that made it, the planner's explanation, and
 * Release while it is open.
 */
export const LogisticsReservationPanel: React.FC<Props> = ({ reservationId, returnTo, refreshKey, onChanged }) => {
    const gate = useActionGate(LOGISTICS_NODE);
    const [reservation, setReservation] = useState<LogisticsReservationDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [releasing, setReleasing] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        try {
            setReservation(await logisticsReservationClient.getById(reservationId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the reservation.");
        }
    }, [reservationId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="reservation-heading" data-testid="logistics-reservation">
            <h2 id="reservation-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Lock className="mr-2 h-5 w-5" aria-hidden="true" />
                Reservation
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !reservation && <p className="text-sm text-muted">Loading the reservation…</p>}
            {reservation && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Status</dt>
                            <dd data-testid="reservation-status">{reservationStatusLabel(reservation.status)}{reservation.statusReason ? `: ${reservation.statusReason}` : ''}</dd></div>
                        <div><dt className="text-muted">Held</dt>
                            <dd data-testid="reservation-amount">
                                {formatNumber(reservation.collected, 0)} of {formatNumber(reservation.amount, 0)} {reservation.itemBlueprint?.name ?? `× blueprint #${reservation.itemBlueprintId}`} collected
                            </dd></div>
                        <div><dt className="text-muted">At</dt>
                            <dd><Link to={displayPath('Storage', reservation.warehouseStorageId, returnTo)} className="text-primary hover:underline">{reservation.warehouseStorage?.name ?? `Storage #${reservation.warehouseStorageId}`}</Link>
                                {' '}({reservation.warehouse?.name ?? `warehouse #${reservation.warehouseId}`})</dd></div>
                        <div><dt className="text-muted">For</dt>
                            <dd><Link to={displayPath('Storage', reservation.consumerStorageId, returnTo)} className="text-primary hover:underline">{reservation.consumerStorage?.name ?? `Storage #${reservation.consumerStorageId}`}</Link>
                                {' '}({reservation.consumerStructure?.name ?? `structure #${reservation.consumerStructureId}`}, {reservation.priorityClass} priority)</dd></div>
                        <div><dt className="text-muted">Made</dt>
                            <dd>{formatDateTime(reservation.createdAt)}{reservation.plannerRunId != null && <> by <Link to={displayPath('LogisticsPlannerRun', reservation.plannerRunId, returnTo)} className="text-primary hover:underline">run #{reservation.plannerRunId}</Link></>}</dd></div>
                        <div><dt className="text-muted">{reservation.closedAt ? 'Closed' : 'Expires'}</dt>
                            <dd data-testid="reservation-expiry">{formatDateTime(reservation.closedAt ?? reservation.expiresAt)}</dd></div>
                        <div><dt className="text-muted">Collection order</dt>
                            <dd data-testid="reservation-order">
                                {reservation.transportOrderId != null
                                    ? <><Link to={displayPath('TransportOrder', reservation.transportOrderId, returnTo)} className="text-primary hover:underline">#{reservation.transportOrderId}</Link> ({transportStatusLabel(reservation.transportOrderStatus)})</>
                                    : 'None yet'}
                            </dd></div>
                    </dl>
                    {reservation.explanation && (
                        <p className="mt-3 rounded border border-line p-3 text-sm" data-testid="reservation-explanation">{reservation.explanation}</p>
                    )}
                    {reservation.status === 'Open' && !releasing && (
                        <button type="button" className="btn-secondary mt-3 text-sm" disabled={!gate.allowed} title={gate.hint ?? undefined} onClick={() => setReleasing(true)}>
                            Release the reservation
                        </button>
                    )}
                    {releasing && (
                        <ReservationReleaseForm reservationId={reservation.id} onCancel={() => setReleasing(false)}
                            onReleased={released => {
                                setReleasing(false);
                                setReservation(released);
                                onChanged?.();
                            }} />
                    )}
                </>
            )}
        </section>
    );
};

export default LogisticsReservationPanel;
