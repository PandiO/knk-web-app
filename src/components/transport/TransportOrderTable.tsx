import React from 'react';
import { Link } from 'react-router-dom';
import { TransportOrderListDto } from '../../types/dtos/production/TransportDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { transportStatusIsProblem, transportStatusLabel } from '../../utils/transport';

interface Props {
    orders: TransportOrderListDto[];
    returnTo: string | null;
    label: string;
    /** Shown instead of the table when there are no orders. */
    empty?: string;
}

/** Transport order rows (PandiO/knk-workspace#682): status in words, origin, route, units and ETA; each links to its
 *  detail page. Used by the order list and by a structure's transport view. */
export const TransportOrderTable: React.FC<Props> = ({ orders, returnTo, label, empty = 'No orders.' }) => {
    if (orders.length === 0) return <p className="text-sm text-muted">{empty}</p>;
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label={label}>
                <thead>
                    <tr className="text-muted">
                        <th className="pr-4 font-medium">Order</th>
                        <th className="pr-4 font-medium">Status</th>
                        <th className="pr-4 font-medium">Origin</th>
                        <th className="pr-4 font-medium">From</th>
                        <th className="pr-4 font-medium">To</th>
                        <th className="pr-4 font-medium">Units</th>
                        <th className="pr-4 font-medium">Created</th>
                        <th className="font-medium">ETA</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map(order => (
                        <tr key={order.id} className="border-t border-line align-top">
                            <td className="pr-4 py-1">
                                <Link to={displayPath('TransportOrder', order.id, returnTo)} className="text-primary hover:underline">#{order.id}</Link>
                            </td>
                            <td className={`pr-4 py-1 ${transportStatusIsProblem(order.status) ? 'font-medium text-warning-strong' : ''}`}>
                                {transportStatusLabel(order.status)}
                                {order.statusReason ? <span className="block text-xs text-muted">{order.statusReason}</span> : null}
                            </td>
                            <td className="pr-4 py-1">{order.origin}</td>
                            <td className="pr-4 py-1">{order.sourceStructureName ?? order.sourceStorageName ?? `Storage #${order.sourceStorageId}`}</td>
                            <td className="pr-4 py-1">{order.destinations || '-'}</td>
                            <td className="pr-4 py-1">
                                {formatNumber(order.unitsDelivered, 0)} of {formatNumber(order.unitsRequested, 0)} delivered
                                {order.unitsReturned > 0 ? `, ${formatNumber(order.unitsReturned, 0)} returned` : ''}
                            </td>
                            <td className="pr-4 py-1">{formatDateTime(order.createdAt)}</td>
                            <td className="py-1">{order.completedAt ? `Done ${formatDateTime(order.completedAt)}` : order.etaAt ? formatDateTime(order.etaAt) : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TransportOrderTable;
