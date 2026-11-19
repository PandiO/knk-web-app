import React, { useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { stockTransactionClient } from '../../apiClients/stockTransactionClient';
import { useActionGate } from '../../hooks/useActionGate';
import { ECONOMY_ADMIN_NODE, StockReconciliationReportDto, StockRollupResultDto } from '../../types/dtos/stock/StockDtos';
import { formatDateTime, formatNumber } from '../../utils/format';
import { stockRefusalReason } from '../../utils/stock';

/**
 * The stock part of the health view (web-app insight PandiO/knk-workspace#65; production DESIGN § 11.1 "Health:
 * reconciler results"; #675): run the reconciler now (read-only) and see whether every blueprint sums to zero and every
 * line, unit and stored total matches the ledger (A01); run the 30-day roll-up of production moves now (G3, A22).
 */
export const StockLedgerHealthCard: React.FC = () => {
    const economyGate = useActionGate(ECONOMY_ADMIN_NODE);
    const [report, setReport] = useState<StockReconciliationReportDto | null>(null);
    const [rollup, setRollup] = useState<StockRollupResultDto | null>(null);
    const [busy, setBusy] = useState<'reconcile' | 'rollup' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reconcile = async () => {
        setBusy('reconcile');
        setError(null);
        try {
            setReport(await stockTransactionClient.reconcile());
        } catch (err) {
            setError(stockRefusalReason(err) ?? 'The reconciler could not be run.');
        } finally {
            setBusy(null);
        }
    };

    const runRollup = async () => {
        setBusy('rollup');
        setError(null);
        try {
            setRollup(await stockTransactionClient.rollUp());
        } catch (err) {
            setError(stockRefusalReason(err) ?? 'The roll-up could not be run.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className="panel p-4 sm:p-6" aria-labelledby="stock-health-heading" data-testid="stock-health">
            <h2 id="stock-health-heading" className="mb-2 flex items-center text-lg font-semibold text-fg">
                <HeartPulse className="mr-2 h-5 w-5" aria-hidden="true" />
                Ledger health
            </h2>
            <p className="mb-3 text-sm text-muted">
                The reconciler checks that every blueprint sums to zero over all storages (system storages included), that each
                line equals the net of its moves and roll-ups, that unique items sit where their last move put them, and that the
                stored totals match. It also runs every 6 hours while production is enabled.
            </p>
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-sm" disabled={busy !== null} onClick={() => void reconcile()}>
                    Run the reconciler
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={busy !== null || !economyGate.allowed}
                    title={economyGate.hint ?? undefined} onClick={() => void runRollup()}>
                    Roll up old production moves now
                </button>
            </div>
            {error && <p className="mt-2 text-sm field-error" role="alert">{error}</p>}
            {report && (
                <div className="mt-3 text-sm" data-testid="stock-reconcile-report">
                    <p className={`font-medium ${report.clean ? 'text-success-strong' : 'text-danger-strong'}`} data-testid="stock-reconcile-status">
                        {report.clean
                            ? `Clean: ${formatNumber(report.linesChecked)} lines and ${formatNumber(report.unitsChecked)} unique items match the ledger.`
                            : 'Differences found: the ledger and the stock disagree.'}
                    </p>
                    <p className="text-xs text-muted">Checked {formatDateTime(report.checkedAt)}.</p>
                    {!report.clean && (
                        <ol className="mt-2 space-y-1" aria-label="Differences">
                            {report.blueprintImbalanceCount > 0 && <li>Blueprints that don't sum to zero: {formatNumber(report.blueprintImbalanceCount)} ({report.blueprintImbalances.map(b => `#${b.itemBlueprintId} sums to ${formatNumber(b.sum)}`).join(', ')})</li>}
                            {report.lineDifferenceCount > 0 && <li>Lines that differ from their moves: {formatNumber(report.lineDifferenceCount)} ({report.lineDifferences.map(d => `storage #${d.storageId}, blueprint #${d.itemBlueprintId}: line ${formatNumber(d.lineAmount)}, ledger ${formatNumber(d.ledgerNet)}`).join('; ')})</li>}
                            {report.unitDifferenceCount > 0 && <li>Unique items in the wrong storage: {formatNumber(report.unitDifferenceCount)} ({report.unitDifferences.map(d => `item #${d.itemInstanceId}`).join(', ')})</li>}
                            {report.totalDifferenceCount > 0 && <li>Storages whose stored totals differ: {formatNumber(report.totalDifferenceCount)} ({report.totalDifferences.map(d => `storage #${d.storageId}: stored ${formatNumber(d.storedTotalUnits)}, actual ${formatNumber(d.actualTotalUnits)}`).join('; ')})</li>}
                        </ol>
                    )}
                </div>
            )}
            {rollup && (
                <p className="mt-3 text-sm text-fg" data-testid="stock-rollup-result">
                    Roll-up done: {formatNumber(rollup.transactionsRolledUp)} transactions and {formatNumber(rollup.movesRolledUp)} moves from before{' '}
                    {formatDateTime(rollup.cutoff)} became {formatNumber(rollup.rollupRowsWritten)} roll-up rows. Totals are unchanged.
                </p>
            )}
        </section>
    );
};

export default StockLedgerHealthCard;
