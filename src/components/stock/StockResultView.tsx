import React from 'react';
import { StockResultDto } from '../../types/dtos/stock/StockDtos';
import { formatNumber } from '../../utils/format';
import { rejectReasonText, stockResultSummary } from '../../utils/stock';

interface Props {
    result: StockResultDto;
    /** A name per storage id for the line list (the dialog knows them). */
    storageNames?: Record<number, string>;
}

/**
 * A stock request's outcome (PandiO/knk-workspace#675, production DESIGN § 4.5): Applied, Partially applied or Rejected,
 * and per line what was requested, accepted and refused with the reason. Capacity, missing stock and locks are results
 * (200), so this shows them as information, not as an error.
 */
export const StockResultView: React.FC<Props> = ({ result, storageNames }) => {
    const tone = result.status === 'Applied' ? 'text-success-strong' : result.status === 'Rejected' ? 'text-danger-strong' : 'text-warning-strong';
    const name = (id: number) => storageNames?.[id] ?? `Storage #${id}`;
    return (
        <div className="rounded border border-line p-3 text-sm" role="status" aria-label="Result" data-testid="stock-result">
            <p className={`font-medium ${tone}`} data-testid="stock-result-status">{stockResultSummary(result)}</p>
            {result.lines?.length > 0 && (
                <ol className="mt-2 space-y-1" aria-label="Result per line">
                    {result.lines.map(line => {
                        const why = rejectReasonText(line.rejectReason);
                        return (
                            <li key={line.lineNo} className="text-fg">
                                Line {line.lineNo}: {name(line.fromStorageId)} → {name(line.toStorageId)}: requested{' '}
                                {formatNumber(line.requested)}, accepted {formatNumber(line.accepted)}
                                {line.rejected > 0 ? `, refused ${formatNumber(line.rejected)}` : ''}
                                {why && <span className="block text-xs text-warning-strong" data-testid="stock-reject-reason">{why}</span>}
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default StockResultView;
