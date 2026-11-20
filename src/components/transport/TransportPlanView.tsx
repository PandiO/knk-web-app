import React from 'react';
import { TransportPlanDto } from '../../types/dtos/production/TransportDtos';
import { formatDuration, formatNumber } from '../../utils/productionEngine';
import { distanceSourceLabel, shortLines } from '../../utils/transport';

interface Props {
    plan: TransportPlanDto;
    /** The accessible name of the region ("Dry run", "The order the trigger would make"). */
    label: string;
}

/**
 * A transport plan (PandiO/knk-workspace#682; production DESIGN § 7.4, A13): the dry run of a manual order or of the
 * automatic trigger. Errors (the order can't be made) and warnings (it can, but...) first, then the carrier, the cargo
 * with what the source holds, and each leg with its distance, where the distance came from, the time and the room at
 * the stop. Writes nothing.
 */
export const TransportPlanView: React.FC<Props> = ({ plan, label }) => {
    const short = shortLines(plan);
    const names = new Map(plan.lines.map(line => [line.itemBlueprintId, line.itemBlueprintName ?? `Blueprint #${line.itemBlueprintId}`]));
    return (
        <div role="region" aria-label={label} className="space-y-3 text-sm" data-testid="transport-plan">
            <p className={plan.valid ? 'font-medium text-fg' : 'font-medium field-error'} data-testid="transport-plan-verdict">
                {plan.valid ? 'The order can be made.' : 'The order can\'t be made.'}
            </p>
            {plan.errors.length > 0 && (
                <ul aria-label="Plan errors" className="list-disc pl-6 field-error">
                    {plan.errors.map(error => <li key={error}>{error}</li>)}
                </ul>
            )}
            {plan.warnings.length > 0 && (
                <ul aria-label="Plan warnings" className="list-disc rounded-md border border-warning-line bg-warning-muted py-2 pl-8 pr-3 text-warning-strong">
                    {plan.warnings.map(warning => <li key={warning}>{warning}</li>)}
                </ul>
            )}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                <div>
                    <dt className="text-muted">Carrier</dt>
                    <dd data-testid="transport-plan-carrier">
                        {plan.carrierStructureId != null ? `Structure #${plan.carrierStructureId}` : 'Simulated carrier (no worker)'}
                        {plan.workersTotal != null ? `, ${plan.workersPresent ?? 0} of ${plan.workersTotal} workers present` : ''}
                    </dd>
                </div>
                <div>
                    <dt className="text-muted">Capacity and speed</dt>
                    <dd>{plan.carrierCapacity != null ? `${formatNumber(plan.carrierCapacity, 0)} units` : 'Uncapped'}, {formatNumber(plan.speedBlocksPerSecond, 3)} blocks/s</dd>
                </div>
                <div>
                    <dt className="text-muted">Cargo</dt>
                    <dd data-testid="transport-plan-units">{formatNumber(plan.totalUnits, 0)} units</dd>
                </div>
                <div>
                    <dt className="text-muted">Trip time</dt>
                    <dd data-testid="transport-plan-time">{formatDuration(plan.totalSeconds)}</dd>
                </div>
            </dl>
            {plan.lines.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left" aria-label="Plan cargo">
                        <thead>
                            <tr className="text-muted"><th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Requested</th><th className="font-medium">At the source</th></tr>
                        </thead>
                        <tbody>
                            {plan.lines.map(line => (
                                <tr key={line.itemBlueprintId} className={line.available < line.requested ? 'text-warning-strong' : undefined}>
                                    <td className="pr-4">{line.itemBlueprintName ?? `Blueprint #${line.itemBlueprintId}`}</td>
                                    <td className="pr-4">{formatNumber(line.requested, 0)}</td>
                                    <td>{formatNumber(line.available, 0)}{line.available < line.requested ? ' (short)' : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {short.length > 0 && <p className="mt-1 text-xs text-muted">Loading takes what the source holds; the stops get less.</p>}
                </div>
            )}
            {plan.legs.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left" aria-label="Plan legs">
                        <thead>
                            <tr className="text-muted">
                                <th className="pr-4 font-medium">Leg</th><th className="pr-4 font-medium">To</th><th className="pr-4 font-medium">Distance</th>
                                <th className="pr-4 font-medium">Time</th><th className="pr-4 font-medium">Drops</th><th className="font-medium">Room</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plan.legs.map(leg => (
                                <tr key={leg.sequence}>
                                    <td className="pr-4">{leg.sequence}</td>
                                    <td className="pr-4">{leg.toStorageName ?? `Storage #${leg.toStorageId}`}</td>
                                    <td className="pr-4">{formatNumber(leg.distanceBlocks, 1)} blocks ({distanceSourceLabel(leg.distanceSource)})</td>
                                    <td className="pr-4">{formatDuration(leg.seconds)}</td>
                                    <td className="pr-4">{leg.lines.length === 0 ? '-' : leg.lines.map(line => `${formatNumber(line.amount, 0)} × ${names.get(line.itemBlueprintId) ?? `Blueprint #${line.itemBlueprintId}`}`).join(', ')}</td>
                                    <td>{leg.roomUnits == null ? 'Uncapped' : `${formatNumber(leg.roomUnits, 0)} units`}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TransportPlanView;
