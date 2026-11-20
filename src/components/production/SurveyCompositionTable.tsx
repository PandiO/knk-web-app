import React from 'react';
import type { AreaSurveyUnitDto } from '../../types/dtos/production/ProductionYieldDtos';
import { compositionRows } from '../../utils/productionYield';

interface Props {
    units: AreaSurveyUnitDto[] | null | undefined;
    totalUnits?: number | null;
    label?: string;
}

/**
 * A survey's composition (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3.2): each unit key with its count, its share of
 * the survey and, for units in overlapping shared areas, how many structures split it (G7).
 */
export const SurveyCompositionTable: React.FC<Props> = ({ units, totalUnits, label = 'Composition' }) => {
    const rows = compositionRows(units, totalUnits);
    if (rows.length === 0) return <p className="text-sm text-muted">The survey found no units.</p>;
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm" aria-label={label}>
                <thead>
                    <tr className="text-left text-muted">
                        <th className="py-1 pr-4 font-medium">Unit</th>
                        <th className="py-1 pr-4 text-right font-medium">Count</th>
                        <th className="py-1 pr-4 font-medium">Share of the survey</th>
                        <th className="py-1 pr-4 font-medium">Split</th>
                        <th className="py-1 pr-4 font-medium">Extra</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={`${row.unitKey}-${row.sharedBy}`} className="border-t border-line">
                            <td className="py-1 pr-4 font-mono">{row.unitKey}</td>
                            <td className="py-1 pr-4 text-right tabular-nums">{row.count}</td>
                            <td className="py-1 pr-4">
                                <span className="flex items-center gap-2">
                                    <span className="inline-block h-2 w-24 rounded-sm bg-surface-alt" aria-hidden="true">
                                        <span className="block h-2 rounded-sm bg-primary" style={{ width: `${Math.min(100, row.percent)}%` }} />
                                    </span>
                                    <span className="tabular-nums">{row.percent}%</span>
                                </span>
                            </td>
                            <td className="py-1 pr-4">{row.sharedBy > 1 ? `Shared by ${row.sharedBy}` : 'Own'}</td>
                            <td className="py-1 pr-4 text-muted">{row.extra ?? ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SurveyCompositionTable;
