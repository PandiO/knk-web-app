import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Receipt, Undo2 } from 'lucide-react';
import { currencyClient } from '../../../apiClients/currencyClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import { currencyName, parseUtc } from '../../../components/currency/BalanceLedgerTable';
import {
    AlreadyReversedDetailsDto,
    CURRENCY_NODES,
    CurrencyTransactionDetailDto,
    MIN_STAFF_NOTE_LENGTH,
    ReversalResultDto,
} from '../../../types/dtos/currency/CurrencyDtos';

const numberFormat = new Intl.NumberFormat('en-US');

const errorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;

/** The existing reversal from a 409 AlreadyReversed refusal, if that is what the error is. */
const alreadyReversedDetails = (err: unknown): AlreadyReversedDetailsDto | null => {
    const response = (err as { response?: { code?: string; error?: string; details?: AlreadyReversedDetailsDto | null } } | null)?.response;
    const code = response?.code ?? response?.error;
    return code === 'AlreadyReversed' && response?.details?.reversalTransactionPublicId ? response.details : null;
};

/** The transaction's own reversal, from the detail view. */
const reversalOf = (tx: CurrencyTransactionDetailDto): AlreadyReversedDetailsDto | null =>
    tx.reversedByPublicId && tx.reversedAt
        ? {
            reversalTransactionPublicId: tx.reversedByPublicId,
            reversedAt: tx.reversedAt,
            reversedByUserId: tx.reversedByUserId,
            reversedByUsername: tx.reversedByUsername,
        }
        : null;

/** "Already reversed on … by … (reversal …)" - instead of a success message or the Reverse form. */
const AlreadyReversedNotice: React.FC<{ info: AlreadyReversedDetailsDto }> = ({ info }) => {
    const when = parseUtc(info.reversedAt);
    return (
        <div role="status" className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 text-amber-900">
            Already reversed on {Number.isNaN(when.getTime()) ? info.reversedAt : when.toLocaleString()} by{' '}
            {info.reversedByUserId
                ? <Link className="underline" to={`/admin/users/${info.reversedByUserId}`}>{info.reversedByUsername ?? `#${info.reversedByUserId}`}</Link>
                : 'the game server'}{' '}
            (reversal{' '}
            <Link className="font-mono underline" to={`/admin/economy/transactions/${info.reversalTransactionPublicId}`}>{info.reversalTransactionPublicId}</Link>).
        </div>
    );
};

/**
 * One ledger transaction (currency-payments Phase 4, DESIGN.md §3.7 TransactionDetailPage): every
 * leg (players and system accounts), who started it and why, its reversal links, and - for holders
 * of knk.admin.currency.reverse - a Reverse form (note of at least 10 characters, optional partial
 * reversal when the player has spent some of it). The server posts the reversal once and never
 * takes a balance below zero. A reversed transaction shows "Already reversed on … by …" and no
 * form; so does a Reverse refused with 409 AlreadyReversed (someone else was first).
 */
export const TransactionDetailPage: React.FC = () => {
    const { publicId = '' } = useParams<{ publicId: string }>();
    const { allowed: canReverse } = usePermission(CURRENCY_NODES.reverse);

    const [tx, setTx] = React.useState<CurrencyTransactionDetailDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [note, setNote] = React.useState('');
    const [allowPartial, setAllowPartial] = React.useState(false);
    const [reversing, setReversing] = React.useState(false);
    const [reverseError, setReverseError] = React.useState<string | null>(null);
    const [reversal, setReversal] = React.useState<ReversalResultDto | null>(null);
    // Set when the API said someone reversed it after this page loaded (409 AlreadyReversed).
    const [refusedAsReversed, setRefusedAsReversed] = React.useState<AlreadyReversedDetailsDto | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setTx(await currencyClient.getTransaction(publicId));
        } catch (err) {
            setError(errorMessage(err, 'Could not load this transaction.'));
        } finally {
            setLoading(false);
        }
    }, [publicId]);

    React.useEffect(() => {
        setReversal(null);
        setRefusedAsReversed(null);
        void load();
    }, [load]);

    const noteOk = note.trim().length >= MIN_STAFF_NOTE_LENGTH;

    const handleReverse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tx || !noteOk) return;
        setReversing(true);
        setReverseError(null);
        try {
            const result = await currencyClient.reverse(tx.publicId, note.trim(), allowPartial);
            setReversal(result);
            setNote('');
            await load();
        } catch (err) {
            const existing = alreadyReversedDetails(err);
            if (existing) {
                setRefusedAsReversed(existing);
                setNote('');
                await load();
            } else {
                setReverseError(errorMessage(err, 'Could not reverse this transaction.'));
            }
        } finally {
            setReversing(false);
        }
    };

    // A reversal made in this session shows its own success message instead.
    const alreadyReversed = reversal ? null : (refusedAsReversed ?? (tx ? reversalOf(tx) : null));

    let metadata: string | null = null;
    if (tx?.metadataJson) {
        try {
            metadata = JSON.stringify(JSON.parse(tx.metadataJson), null, 2);
        } catch {
            metadata = tx.metadataJson;
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <Link to="/admin/users/balance-log" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Balance event log
                </Link>

                {loading && !tx && (
                    <div className="flex items-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading…
                    </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}

                {tx && (
                    <>
                        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                            <h1 className="text-xl font-bold text-gray-900 flex items-center">
                                <Receipt className="h-5 w-5 mr-2" />
                                Transaction <span className="ml-2 font-mono text-base">{tx.publicId}</span>
                            </h1>
                            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div><dt className="text-gray-500">When</dt><dd className="text-gray-900">{parseUtc(tx.createdAt).toLocaleString()}</dd></div>
                                <div><dt className="text-gray-500">Kind / reason code</dt><dd className="text-gray-900">{tx.kind} · {tx.reasonCode}</dd></div>
                                <div className="sm:col-span-2"><dt className="text-gray-500">Reason</dt><dd className="text-gray-900 break-words">{tx.reason}</dd></div>
                                <div>
                                    <dt className="text-gray-500">Initiator</dt>
                                    <dd className="text-gray-900">
                                        {tx.initiatorUserId
                                            ? <Link to={`/admin/users/${tx.initiatorUserId}`} className="text-primary hover:underline">{tx.initiatorUsername ?? `#${tx.initiatorUserId}`}</Link>
                                            : (tx.initiatorComponent ?? tx.initiator)}
                                        <span className="text-gray-500"> ({tx.initiator}{tx.initiatorUserId && tx.initiatorComponent ? ` · ${tx.initiatorComponent}` : ''})</span>
                                    </dd>
                                </div>
                                <div><dt className="text-gray-500">Source</dt><dd className="text-gray-900">{tx.sourceType ? `${tx.sourceType} ${tx.sourceRef ?? ''}` : '-'}</dd></div>
                                {tx.reversesPublicId && (
                                    <div><dt className="text-gray-500">Reverses</dt><dd><Link className="font-mono text-primary hover:underline" to={`/admin/economy/transactions/${tx.reversesPublicId}`}>{tx.reversesPublicId}</Link></dd></div>
                                )}
                                {tx.reversedByPublicId && (
                                    <div><dt className="text-gray-500">Reversed by</dt><dd><Link className="font-mono text-primary hover:underline" to={`/admin/economy/transactions/${tx.reversedByPublicId}`}>{tx.reversedByPublicId}</Link></dd></div>
                                )}
                                {tx.correlationId && <div><dt className="text-gray-500">Correlation</dt><dd className="font-mono text-xs text-gray-900">{tx.correlationId}</dd></div>}
                            </dl>
                            {metadata && (
                                <details className="mt-4 text-sm">
                                    <summary className="cursor-pointer text-gray-600">Details</summary>
                                    <pre className="mt-2 bg-gray-50 border rounded p-3 text-xs overflow-x-auto">{metadata}</pre>
                                </details>
                            )}
                        </div>

                        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Entries</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-600 border-b">
                                            <th className="py-2 pr-4">Account</th>
                                            <th className="py-2 pr-4">Currency</th>
                                            <th className="py-2 pr-4">Operation</th>
                                            <th className="py-2 pr-4 text-right">Amount</th>
                                            <th className="py-2 text-right">Before → after</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tx.entries.map(entry => (
                                            <tr key={entry.entryId} className="border-b last:border-b-0">
                                                <td className="py-2 pr-4">
                                                    {entry.accountKind === 'User' && entry.userId
                                                        ? <Link to={`/admin/users/${entry.userId}`} className="text-primary hover:underline">{entry.username ?? `#${entry.userId}`}</Link>
                                                        : <span className="font-mono text-xs text-gray-600">{entry.systemAccount}</span>}
                                                </td>
                                                <td className="py-2 pr-4">{currencyName(entry.currency)}</td>
                                                <td className="py-2 pr-4">{entry.operation}</td>
                                                <td className={`py-2 pr-4 text-right font-semibold ${entry.amount > 0 ? 'text-green-700' : entry.amount < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                                                    {entry.amount > 0 ? '+' : ''}{numberFormat.format(entry.amount)}
                                                </td>
                                                <td className="py-2 text-right text-gray-700">
                                                    {entry.balanceBefore != null && entry.balanceAfter != null
                                                        ? `${numberFormat.format(entry.balanceBefore)} → ${numberFormat.format(entry.balanceAfter)}`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {reversal && (
                            <div className="rounded-md p-3 text-sm bg-green-50 border border-green-200 text-green-900">
                                Reversed as{' '}
                                <Link className="font-mono underline" to={`/admin/economy/transactions/${reversal.posting.publicId}`}>{reversal.posting.publicId}</Link>
                                {reversal.partial && ' - partially: the player had spent some of it, the shortfall is recorded in the reversal.'}
                            </div>
                        )}

                        {alreadyReversed && <AlreadyReversedNotice info={alreadyReversed} />}

                        {canReverse && tx.reversible && !alreadyReversed && (
                            <form className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-3" onSubmit={(e) => void handleReverse(e)}>
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Undo2 className="h-5 w-5 mr-2" />
                                    Reverse this transaction
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Posts the exact opposite of every player leg above, once. A balance never goes below zero: if a
                                    player has spent some of it, the reversal is refused unless you allow a partial reversal.
                                </p>
                                <div>
                                    <label htmlFor="reverse-note" className="block text-xs text-gray-500 mb-1">
                                        Reason (at least {MIN_STAFF_NOTE_LENGTH} characters)
                                    </label>
                                    <textarea id="reverse-note" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" rows={2}
                                        value={note} onChange={e => setNote(e.target.value)} maxLength={450} />
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={allowPartial} onChange={e => setAllowPartial(e.target.checked)} />
                                    Allow a partial reversal (reverse what is left)
                                </label>
                                <div className="flex items-center gap-3">
                                    <button type="submit" className="btn-primary text-sm" disabled={!noteOk || reversing}>
                                        {reversing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reverse'}
                                    </button>
                                    {reverseError && <span className="text-sm text-red-600">{reverseError}</span>}
                                </div>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TransactionDetailPage;
