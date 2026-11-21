import React from 'react';
import { Link } from 'react-router-dom';
import { LogisticsReservationListDto } from '../../types/dtos/production/LogisticsDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { reservationStatusLabel } from '../../utils/logistics';

interface Props {
    reservations: LogisticsReservationListDto[];
    returnTo: string | null;
    label: string;
    empty: string;
    /** Shown on open reservations when staff may release them. */
    onRelease?: (reservation: LogisticsReservationListDto) => void;
    releaseHint?: string | null;
}

/**
 * Reservations of warehouse stock for consumers (PandiO/knk-workspace#686; TOWN_LOGISTICS § 5.1): the consumer, the
 * item, the amount (collected of reserved), the warehouse, the status, the expiry and the collection order. An open one
 * can be released before its order loads.
 */
export const LogisticsReservationTable: React.FC<Props> = ({ reservations, returnTo, label, empty, onRelease, releaseHint }) => {
    if (reservations.length === 0) return <p className="text-sm text-muted">{empty}</p>;
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label={label}>
                <thead>
                    <tr className="text-muted">
                        <th className="pr-4 font-medium">Reservation</th><th className="pr-4 font-medium">Consumer</th>
                        <th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Amount</th>
                        <th className="pr-4 font-medium">Warehouse</th><th className="pr-4 font-medium">Status</th>
                        <th className="pr-4 font-medium">Expires</th><th className="pr-4 font-medium">Order</th>
                        {onRelease && <th className="font-medium"><span className="sr-only">Actions</span></th>}
                    </tr>
                </thead>
                <tbody>
                    {reservations.map(row => (
                        <tr key={row.id} className="border-t border-line">
                            <td className="pr-4 py-1">
                                <Link to={displayPath('LogisticsReservation', row.id, returnTo)} className="text-primary hover:underline">#{row.id}</Link>
                            </td>
                            <td className="pr-4 py-1">{row.consumerStructureName ?? `#${row.consumerStructureId}`}</td>
                            <td className="pr-4 py-1">{row.itemBlueprintName ?? `#${row.itemBlueprintId}`}</td>
                            <td className="pr-4 py-1">{formatNumber(row.collected, 0)} of {formatNumber(row.amount, 0)}</td>
                            <td className="pr-4 py-1">{row.warehouseName ?? `#${row.warehouseId}`}</td>
                            <td className="pr-4 py-1">{reservationStatusLabel(row.status)} · {row.priorityClass}</td>
                            <td className="pr-4 py-1">{formatDateTime(row.expiresAt)}</td>
                            <td className="pr-4 py-1">
                                {row.transportOrderId != null
                                    ? <Link to={displayPath('TransportOrder', row.transportOrderId, returnTo)} className="text-primary hover:underline">#{row.transportOrderId}</Link>
                                    : '-'}
                            </td>
                            {onRelease && (
                                <td className="py-1">
                                    {row.status === 'Open' && (
                                        <button type="button" className="btn-secondary text-xs" disabled={!!releaseHint} title={releaseHint ?? undefined}
                                            onClick={() => onRelease(row)} aria-label={`Release reservation #${row.id}`}>
                                            Release
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default LogisticsReservationTable;
