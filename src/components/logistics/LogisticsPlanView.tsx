import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogisticsPlanEntryDto, LogisticsPlannedOrderDto, LogisticsReleasedDto } from '../../types/dtos/production/LogisticsDtos';
import { formatNumber } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { logisticsSourceLabel, planOutcomeLabel, planOutcomeTone } from '../../utils/logistics';

interface Props {
    /** The accessible name of the region ("Dry run", "Planner run", "Plan explanation"). */
    label: string;
    entries: LogisticsPlanEntryDto[];
    orders?: LogisticsPlannedOrderDto[];
    released?: LogisticsReleasedDto[];
    collected?: number[];
    warnings?: string[];
    summary?: string | null;
    returnTo: string | null;
}

const TONE_CLASS: Record<string, string> = {
    ok: 'text-success-strong',
    partial: 'text-warning-strong',
    held: 'field-error',
    neutral: 'text-muted',
};

const entryKey = (entry: LogisticsPlanEntryDto) => `${entry.consumerStorageId}-${entry.itemBlueprintId}`;

/**
 * A logistics plan (PandiO/knk-workspace#686; TOWN_LOGISTICS § 5, acceptance A17): "why did (or didn't) the bakery get
 * flour". The summary and warnings first, then one item per consumer line in the order the planner served them
 * (priority class, then road distance): the outcome in words, stock (with what is on the way) against min and max, the
 * shortfall, what was reserved and where, where the min and max came from, the rules it used and the planner's own
 * explanation. Then the collection orders it makes (carried by the consumer's own worker), and the reservations it
 * released or saw collected. "Only the lines that didn't get everything" hides the rest.
 */
export const LogisticsPlanView: React.FC<Props> = ({ label, entries, orders, released, collected, warnings, summary, returnTo }) => {
    const [onlyProblems, setOnlyProblems] = useState(false);
    const shown = onlyProblems ? entries.filter(entry => planOutcomeTone(entry.outcome) === 'held' || planOutcomeTone(entry.outcome) === 'partial') : entries;
    return (
        <div role="region" aria-label={label} className="space-y-3 text-sm" data-testid="logistics-plan">
            {summary && <p className="font-medium text-fg" data-testid="logistics-plan-summary">{summary}</p>}
            {warnings && warnings.length > 0 && (
                <ul aria-label="Plan warnings" className="list-disc rounded-md border border-warning-line bg-warning-muted py-2 pl-8 pr-3 text-warning-strong">
                    {warnings.map(warning => <li key={warning}>{warning}</li>)}
                </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-fg">Consumer lines ({entries.length})</h4>
                {entries.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-muted">
                        <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} />
                        Only the lines that didn't get everything
                    </label>
                )}
            </div>
            {entries.length === 0 && <p className="text-muted">No consumer is at or below its min: nothing to reserve.</p>}
            {shown.length > 0 && (
                <ol aria-label="Consumer lines" className="space-y-2">
                    {shown.map(entry => {
                        const consumer = entry.consumerStructureName ?? `Structure #${entry.consumerStructureId}`;
                        const item = entry.itemBlueprintName ?? `Blueprint #${entry.itemBlueprintId}`;
                        const tone = planOutcomeTone(entry.outcome);
                        return (
                            <li key={entryKey(entry)} aria-label={`${consumer}: ${item}`} className="rounded border border-line p-3"
                                data-testid={`plan-entry-${entryKey(entry)}`}>
                                <p className="flex flex-wrap items-baseline gap-x-2">
                                    <Link to={displayPath('Structure', entry.consumerStructureId, returnTo)} className="font-medium text-primary hover:underline">{consumer}</Link>
                                    <span className="text-muted">{entry.consumerStorageName ?? `Storage #${entry.consumerStorageId}`}</span>
                                    <span className="font-medium">{item}</span>
                                    <span className={`font-semibold ${TONE_CLASS[tone]}`} data-testid="plan-entry-outcome">{planOutcomeLabel(entry.outcome)}</span>
                                </p>
                                <p className="mt-1 text-xs text-muted" data-testid="plan-entry-numbers">
                                    {entry.priorityClass} priority · stock {formatNumber(entry.stock, 0)} (with what is on the way) · min {formatNumber(entry.reorderPoint, 0)},
                                    max {formatNumber(entry.targetLevel, 0)} from {logisticsSourceLabel(entry.settingSource)} · short {formatNumber(entry.shortfall, 0)} ·
                                    reserved {formatNumber(entry.reserved, 0)}{entry.warehouseName ? ` at ${entry.warehouseName}` : ''}
                                    {entry.ruleIds.length > 0 ? ` · rules ${entry.ruleIds.map(id => `#${id}`).join(', ')}` : ''}
                                </p>
                                <p className="mt-1 text-fg" data-testid="plan-entry-explanation">{entry.explanation}</p>
                                {(entry.reservationId != null || entry.transportOrderId != null) && (
                                    <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
                                        {entry.reservationId != null && (
                                            <Link to={displayPath('LogisticsReservation', entry.reservationId, returnTo)} className="text-primary hover:underline">Reservation #{entry.reservationId}</Link>
                                        )}
                                        {entry.transportOrderId != null && (
                                            <Link to={displayPath('TransportOrder', entry.transportOrderId, returnTo)} className="text-primary hover:underline">Collection order #{entry.transportOrderId}</Link>
                                        )}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
            {orders && (
                <>
                    <h4 className="pt-2 text-sm font-semibold text-fg">Collection orders ({orders.length})</h4>
                    {orders.length === 0 ? <p className="text-muted">No collection order.</p> : (
                        <ul aria-label="Collection orders" className="space-y-2">
                            {orders.map(order => (
                                <li key={`${order.consumerStorageId}-${order.warehouseStorageId}`} className="rounded border border-line p-3">
                                    <p>
                                        <span className="font-medium">{order.consumerStructureName ?? `Structure #${order.consumerStructureId}`}</span>
                                        {' '}collects from {order.warehouseName ?? `Warehouse #${order.warehouseId}`} with its own worker
                                        {' '}({order.workersPresent} of {order.workersTotal} present, carries up to {formatNumber(order.carrierCapacity, 0)} units)
                                        {order.transportOrderId != null && (
                                            <>: <Link to={displayPath('TransportOrder', order.transportOrderId, returnTo)} className="text-primary hover:underline">order #{order.transportOrderId}</Link></>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {order.lines.map(line => {
                                            const name = entries.find(entry => entry.itemBlueprintId === line.itemBlueprintId)?.itemBlueprintName ?? `Blueprint #${line.itemBlueprintId}`;
                                            return `${formatNumber(line.amount, 0)} × ${name}`;
                                        }).join(', ')}
                                    </p>
                                    {order.warnings.length > 0 && (
                                        <ul aria-label="Order warnings" className="mt-1 list-disc pl-6 text-warning-strong">
                                            {order.warnings.map(warning => <li key={warning}>{warning}</li>)}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
            {released && released.length > 0 && (
                <>
                    <h4 className="pt-2 text-sm font-semibold text-fg">Released reservations ({released.length})</h4>
                    <ul aria-label="Released reservations" className="list-disc pl-6">
                        {released.map(item => (
                            <li key={item.reservationId}>
                                <Link to={displayPath('LogisticsReservation', item.reservationId, returnTo)} className="text-primary hover:underline">#{item.reservationId}</Link>
                                {' '}{item.status}: {item.reason}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {collected && collected.length > 0 && (
                <p className="text-muted" data-testid="logistics-plan-collected">
                    Collected since the last run: {collected.map(id => `#${id}`).join(', ')}.
                </p>
            )}
        </div>
    );
};

export default LogisticsPlanView;
