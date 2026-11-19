import React from 'react';
import type { AreaSurveyTrendDto } from '../../types/dtos/production/ProductionYieldDtos';
import { formatDateTime } from '../../utils/format';
import { signedChange, trendRows } from '../../utils/productionYield';

interface Props {
    trend: AreaSurveyTrendDto;
}

const W = 120;
const H = 28;

function Sparkline({ counts, label }: { counts: number[]; label: string }) {
    if (counts.length < 2) return <span className="text-xs text-muted">one survey</span>;
    const max = Math.max(...counts, 1);
    const x = (i: number) => (i / (counts.length - 1)) * (W - 4) + 2;
    const y = (v: number) => H - 2 - (v / max) * (H - 4);
    const points = counts.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="text-primary">
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {counts.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={6} fill="transparent"><title>{`${v}`}</title></circle>
            ))}
        </svg>
    );
}

/**
 * An area's trend (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3.2: "a forest being cut down"): one row per unit key
 * with its count in the first and latest survey, the change and a small line of every count, oldest first. One small
 * chart per unit, each on its own scale, so no unit's colour has to be told apart from another's.
 */
export const SurveyTrendTable: React.FC<Props> = ({ trend }) => {
    const rows = trendRows(trend);
    if (trend.surveys.length === 0 || rows.length === 0) return <p className="text-sm text-muted">No surveys yet.</p>;
    const first = trend.surveys[0];
    const last = trend.surveys[trend.surveys.length - 1];
    return (
        <div className="overflow-x-auto">
            <p className="mb-2 text-sm text-muted">
                {trend.surveys.length} {trend.surveys.length === 1 ? 'survey' : 'surveys'} from {formatDateTime(first.surveyedAt)} to {formatDateTime(last.surveyedAt)}.
            </p>
            <table className="min-w-full text-sm" aria-label="Trend">
                <thead>
                    <tr className="text-left text-muted">
                        <th className="py-1 pr-4 font-medium">Unit</th>
                        <th className="py-1 pr-4 text-right font-medium">First</th>
                        <th className="py-1 pr-4 text-right font-medium">Latest</th>
                        <th className="py-1 pr-4 text-right font-medium">Change</th>
                        <th className="py-1 pr-4 font-medium">Over time</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.unitKey} className="border-t border-line">
                            <td className="py-1 pr-4 font-mono">{row.unitKey}</td>
                            <td className="py-1 pr-4 text-right tabular-nums">{row.first}</td>
                            <td className="py-1 pr-4 text-right tabular-nums">{row.last}</td>
                            <td className="py-1 pr-4 text-right tabular-nums">{signedChange(row.change)}</td>
                            <td className="py-1 pr-4"><Sparkline counts={row.counts} label={`${row.unitKey}: ${row.counts.join(', ')}`} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SurveyTrendTable;
