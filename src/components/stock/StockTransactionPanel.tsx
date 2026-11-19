import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, Undo2 } from 'lucide-react';
import { stockTransactionClient } from '../../apiClients/stockTransactionClient';
import { useActionGate } from '../../hooks/useActionGate';
import { ECONOMY_ADMIN_NODE, StockResultDto, StockTransactionDto } from '../../types/dtos/stock/StockDtos';
import { formatDateTime, formatNumber } from '../../utils/format';
import { displayPath } from '../../utils/returnTo';
import { blueprintMovesPath, enumLabel, itemInstanceMovesPath, newIdempotencyKey, stockRefusalReason } from '../../utils/stock';
import { StockResultView } from './StockResultView';

interface Props {
    transactionId: number;
    returnTo: string | null;
    onChanged?: () => void;
}

/**
 * A ledger transaction (PandiO/knk-workspace#675; production DESIGN § 4.3): who and why, its moves with both storages
 * and the item (each linking to the line's moves), the correction that reversed it or the transaction it reverses, and
 * Reverse, which writes a compensating Correction (never an edit) for holders of knk.economy.admin.
 */
export const StockTransactionPanel: React.FC<Props> = ({ transactionId, returnTo, onChanged }) => {
    const economyGate = useActionGate(ECONOMY_ADMIN_NODE);
    const [tx, setTx] = useState<StockTransactionDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reversing, setReversing] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [reverseError, setReverseError] = useState<string | null>(null);
    const [result, setResult] = useState<StockResultDto | null>(null);
    const [key, setKey] = useState(() => newIdempotencyKey('reverse'));

    const load = useCallback(async () => {
        setError(null);
        try {
            setTx(await stockTransactionClient.getById(transactionId));
        } catch (err) {
            setError(stockRefusalReason(err) ?? "Couldn't load the transaction.");
        }
    }, [transactionId]);

    useEffect(() => {
        setTx(null);
        void load();
    }, [load]);

    const reverse = async () => {
        setBusy(true);
        setReverseError(null);
        try {
            const answer = await stockTransactionClient.reverse(transactionId, { note: note.trim() || null, idempotencyKey: key });
            setResult(answer);
            if (answer.status !== 'Rejected') {
                setReversing(false);
                setKey(newIdempotencyKey('reverse'));
                await load();
                onChanged?.();
            }
        } catch (err) {
            setReverseError(stockRefusalReason(err) ?? 'The transaction could not be reversed.');
        } finally {
            setBusy(false);
        }
    };

    const txLink = (id: number) => (
        <Link to={displayPath('StockTransaction', id, returnTo)} className="text-primary hover:underline">Transaction #{id}</Link>
    );
    const canReverse = tx && tx.reversedByTransactionId == null && tx.reason !== 'Correction';

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="stock-transaction-heading" data-testid="stock-transaction">
            <h2 id="stock-transaction-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <ScrollText className="mr-2 h-5 w-5" aria-hidden="true" />
                Ledger entry
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !tx && <p className="text-sm text-muted">Loading the transaction…</p>}
            {tx && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Reason</dt><dd className="text-fg" data-testid="stock-transaction-reason">{enumLabel(tx.reason)}</dd></div>
                        <div><dt className="text-muted">Mode</dt><dd className="text-fg">{enumLabel(tx.mode)}</dd></div>
                        <div>
                            <dt className="text-muted">Actor</dt>
                            <dd className="text-fg">
                                {tx.actorUsername ?? (tx.actorUserId != null ? `User #${tx.actorUserId}` : enumLabel(tx.actorKind))}
                                {tx.actorComponent ? ` (${tx.actorComponent})` : ''}
                            </dd>
                        </div>
                        <div><dt className="text-muted">When</dt><dd className="text-fg">{formatDateTime(tx.createdAt)}</dd></div>
                        <div><dt className="text-muted">Source</dt><dd className="text-fg">{tx.sourceType ? `${tx.sourceType}${tx.sourceRef ? ` ${tx.sourceRef}` : ''}` : '-'}</dd></div>
                        <div><dt className="text-muted">Note</dt><dd className="text-fg">{tx.note ?? '-'}</dd></div>
                        {tx.reversesTransactionId != null && (
                            <div><dt className="text-muted">Reverses</dt><dd className="text-fg" data-testid="stock-transaction-reverses">{txLink(tx.reversesTransactionId)}</dd></div>
                        )}
                        <div>
                            <dt className="text-muted">Reversed by</dt>
                            <dd className="text-fg" data-testid="stock-transaction-reversed-by">
                                {tx.reversedByTransactionId != null ? txLink(tx.reversedByTransactionId) : 'Not reversed'}
                            </dd>
                        </div>
                    </dl>

                    <h3 className="mb-2 mt-6 text-base font-semibold text-fg">Moves</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm" aria-label="Moves">
                            <thead>
                                <tr className="text-left text-muted">
                                    <th className="py-1 pr-4 font-medium">Line</th>
                                    <th className="py-1 pr-4 font-medium">From</th>
                                    <th className="py-1 pr-4 font-medium">To</th>
                                    <th className="py-1 pr-4 font-medium">Item</th>
                                    <th className="py-1 font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tx.moves.map(move => (
                                    <tr key={move.id} className="border-t border-line">
                                        <td className="py-1 pr-4">{move.lineNo}</td>
                                        <td className="py-1 pr-4">
                                            <Link to={displayPath('Storage', move.fromStorageId, returnTo)} className="text-primary hover:underline">{move.fromStorageName ?? `Storage #${move.fromStorageId}`}</Link>
                                        </td>
                                        <td className="py-1 pr-4">
                                            <Link to={displayPath('Storage', move.toStorageId, returnTo)} className="text-primary hover:underline">{move.toStorageName ?? `Storage #${move.toStorageId}`}</Link>
                                        </td>
                                        <td className="py-1 pr-4">
                                            {move.itemInstanceId != null
                                                ? <Link to={itemInstanceMovesPath(move.itemInstanceId)} className="text-primary hover:underline">Item #{move.itemInstanceId}{move.itemBlueprintName ? ` (${move.itemBlueprintName})` : ''}</Link>
                                                : move.itemBlueprintId != null
                                                    ? <Link to={blueprintMovesPath(move.itemBlueprintId)} className="text-primary hover:underline">{move.itemBlueprintName ?? `Blueprint #${move.itemBlueprintId}`}</Link>
                                                    : '-'}
                                        </td>
                                        <td className="py-1">{formatNumber(move.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {canReverse && !reversing && (
                        <div className="mt-4 border-t border-line pt-4">
                            <button type="button" className="btn-secondary text-sm" disabled={!economyGate.allowed} title={economyGate.hint ?? undefined}
                                onClick={() => { setReversing(true); setResult(null); setReverseError(null); }}>
                                <Undo2 className="mr-1 h-4 w-4" aria-hidden="true" />Reverse
                            </button>
                            {economyGate.hint && <p className="mt-1 text-xs text-muted">{economyGate.hint}</p>}
                        </div>
                    )}
                    {reversing && (
                        <form className="mt-4 space-y-2 border-t border-line pt-4" aria-label="Reverse the transaction"
                            onSubmit={e => { e.preventDefault(); void reverse(); }}>
                            <p className="text-sm text-fg">
                                Writes a Correction transaction that moves every move of this one back. If a storage no longer holds the stock, nothing moves.
                            </p>
                            <label htmlFor="stock-reverse-note" className="block text-sm font-medium text-fg">Note</label>
                            <input id="stock-reverse-note" className="input w-full px-3 py-2" value={note} disabled={busy} onChange={e => setNote(e.target.value)} />
                            <div className="flex gap-2">
                                <button type="submit" className="btn-primary text-sm" disabled={busy}>Write the correction</button>
                                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setReversing(false)}>Cancel</button>
                            </div>
                            {reverseError && <p className="text-sm field-error" role="alert">{reverseError}</p>}
                        </form>
                    )}
                    {result && <div className="mt-3"><StockResultView result={result} /></div>}
                </>
            )}
        </section>
    );
};

export default StockTransactionPanel;
