import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductionCycleRecordDto } from '../../types/dtos/production/ProductionEngineDtos';
import { displayPath } from '../../utils/returnTo';
import { formatDateTime } from '../../utils/format';
import {
    formatDuration,
    formatNumber,
    formatRate,
    lineStatusIsProblem,
    lineStatusLabel,
} from '../../utils/productionEngine';
import { RateBreakdown } from './RateBreakdown';

interface Props {
    cycles: ProductionCycleRecordDto[];
    returnTo: string | null;
    /** The table's accessible name. */
    label?: string;
    /** Show the output column (a structure's cycles span several lines). */
    showOutput?: boolean;
}

/**
 * The cycle trace (PandiO/knk-workspace#678; production DESIGN § 9, § 11.1, acceptance A08, insight #65): one row per
 * settle that accrued or changed the line's state, newest first, with what was emitted and accepted, the state after
 * and why less was accepted. "Trace" opens the cycle's rate formula: the base rate, each modifier in the order applied,
 * the unlock and the workers present, the accrual and the inputs taken.
 */
export const ProductionCycleTable: React.FC<Props> = ({ cycles, returnTo, label = 'Cycles', showOutput = true }) => {
    const [open, setOpen] = useState<number | null>(null);
    if (cycles.length === 0) return <p className="text-sm text-muted">No cycles recorded yet.</p>;
    const columns = showOutput ? 8 : 7;
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm" aria-label={label}>
                <thead>
                    <tr className="text-left text-muted">
                        <th className="py-1 pr-4 font-medium">Settled</th>
                        {showOutput && <th className="py-1 pr-4 font-medium">Output</th>}
                        <th className="py-1 pr-4 font-medium">Period</th>
                        <th className="py-1 pr-4 font-medium">Rate</th>
                        <th className="py-1 pr-4 font-medium">Accepted</th>
                        <th className="py-1 pr-4 font-medium">State after</th>
                        <th className="py-1 pr-4 font-medium">Shortfall</th>
                        <th className="py-1 pr-4 font-medium"><span className="sr-only">Trace</span></th>
                    </tr>
                </thead>
                <tbody>
                    {cycles.map(cycle => (
                        <React.Fragment key={cycle.id}>
                            <tr className="border-t border-line" data-testid={`cycle-${cycle.id}`}>
                                <td className="py-1 pr-4 whitespace-nowrap">{formatDateTime(cycle.settledAt)}</td>
                                {showOutput && (
                                    <td className="py-1 pr-4">
                                        <Link to={displayPath('ProductionLine', cycle.productionLineId, returnTo)} className="text-primary hover:underline">
                                            {cycle.itemBlueprintName ?? `Line #${cycle.productionLineId}`}
                                        </Link>
                                    </td>
                                )}
                                <td className="py-1 pr-4 whitespace-nowrap">
                                    {formatDuration(cycle.elapsedSeconds)}
                                    {cycle.skippedSeconds > 0 ? ` (${formatDuration(cycle.skippedSeconds)} past the catch-up cap)` : ''}
                                </td>
                                <td className="py-1 pr-4">{formatRate(cycle.effectiveRatePerHour)}</td>
                                <td className="py-1 pr-4">{cycle.accepted} of {cycle.emitted}</td>
                                <td className={`py-1 pr-4 ${lineStatusIsProblem(cycle.statusAfter) ? 'font-medium text-warning-strong' : ''}`}>
                                    {lineStatusLabel(cycle.statusAfter)}
                                </td>
                                <td className="py-1 pr-4">{cycle.shortfallReason || '-'}</td>
                                <td className="py-1 pr-4">
                                    <button type="button" className="btn-secondary text-xs" aria-expanded={open === cycle.id}
                                        aria-controls={`cycle-trace-${cycle.id}`}
                                        onClick={() => setOpen(previous => previous === cycle.id ? null : cycle.id)}>
                                        {open === cycle.id ? 'Hide trace' : 'Trace'}
                                    </button>
                                </td>
                            </tr>
                            {open === cycle.id && (
                                <tr id={`cycle-trace-${cycle.id}`}>
                                    <td colSpan={columns} className="bg-surface-alt px-3 py-3">
                                        <RateBreakdown
                                            label={`Trace of cycle ${cycle.id}`}
                                            baseRatePerHour={cycle.baseRatePerHour}
                                            modifiers={cycle.modifiers}
                                            unlockFactor={cycle.unlockFactor}
                                            workerFactor={cycle.workerFactor}
                                            effectiveRatePerHour={cycle.effectiveRatePerHour}
                                        />
                                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                                            <div><dt className="inline text-muted">Workers present: </dt><dd className="inline">{cycle.workersPresent} of {cycle.workersTotal}</dd></div>
                                            <div><dt className="inline text-muted">Accrued: </dt><dd className="inline">{formatNumber(cycle.accruedBefore, 4)} → {formatNumber(cycle.accruedAfter, 4)}</dd></div>
                                            <div><dt className="inline text-muted">Rate source: </dt><dd className="inline">{cycle.rateSource}</dd></div>
                                            <div>
                                                <dt className="inline text-muted">Inputs taken: </dt>
                                                <dd className="inline">
                                                    {cycle.inputs.length === 0 ? 'None' : cycle.inputs.map(input => `${input.consumed} × blueprint #${input.itemBlueprintId}`).join(', ')}
                                                </dd>
                                            </div>
                                            {cycle.stockTransactionId != null && (
                                                <div>
                                                    <dt className="inline text-muted">Ledger: </dt>
                                                    <dd className="inline">
                                                        <Link to={displayPath('StockTransaction', cycle.stockTransactionId, returnTo)} className="text-primary hover:underline">
                                                            Transaction #{cycle.stockTransactionId}
                                                        </Link>
                                                    </dd>
                                                </div>
                                            )}
                                        </dl>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ProductionCycleTable;
