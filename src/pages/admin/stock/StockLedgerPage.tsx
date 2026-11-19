import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { stockTransactionClient } from '../../../apiClients/stockTransactionClient';
import { storageClient } from '../../../apiClients/storageClient';
import { Pager } from '../../../components/Pager';
import { StockLedgerHealthCard } from '../../../components/stock/StockLedgerHealthCard';
import {
    STOCK_REASONS,
    StockMoveDto,
    StockMoveRollupDto,
    StockTransactionListDto,
} from '../../../types/dtos/stock/StockDtos';
import { formatDate, formatDateTime, formatNumber } from '../../../utils/format';
import { buildReturnTo, displayPath } from '../../../utils/returnTo';
import {
    LEDGER_FILTER_KEYS,
    LedgerState,
    LedgerView,
    enumLabel,
    ledgerQuery,
    ledgerSearch,
    readLedgerState,
    signedAmount,
    stockRefusalReason,
} from '../../../utils/stock';

const PAGE_SIZE = 50;
/** The API's page cap (TerritoryPaging.MaxPageSize): the drill-down sums at most this many moves and roll-ups. */
const SUM_PAGE_SIZE = 200;

const VIEW_LABELS: Record<LedgerView, string> = { transactions: 'Transactions', moves: 'Moves', rollups: 'Roll-ups' };

const FILTER_FIELDS: { key: string; label: string; type: 'id' | 'text' | 'date' | 'reason' }[] = [
    { key: 'storageId', label: 'Storage id', type: 'id' },
    { key: 'itemBlueprintId', label: 'Blueprint id', type: 'id' },
    { key: 'itemInstanceId', label: 'Item instance id', type: 'id' },
    { key: 'transactionId', label: 'Transaction id', type: 'id' },
    { key: 'reason', label: 'Reason', type: 'reason' },
    { key: 'actorUserId', label: 'Actor user id', type: 'id' },
    { key: 'sourceType', label: 'Source type', type: 'text' },
    { key: 'sourceRef', label: 'Source reference', type: 'text' },
    { key: 'since', label: 'From (date)', type: 'date' },
    { key: 'until', label: 'Until (date, inclusive)', type: 'date' },
];

interface LineSum {
    lineAmount: number | null;
    blueprintName: string | null;
    storageName: string | null;
    movesIn: number;
    movesOut: number;
    rollups: number;
    movesCounted: number;
    movesTotal: number;
    rollupsCounted: number;
    rollupsTotal: number;
}

/**
 * The ledger explorer (PandiO/knk-workspace#675; production DESIGN § 11.1, IMPLEMENTATION_PLAN § P1): stock
 * transactions, moves and the 30-day roll-ups (A22), filtered by storage, blueprint, unique item, reason, actor,
 * reference and time. The filters live in the address, so a storage page's number opens "the moves that made it"
 * (storage + blueprint), with the line's amount next to the net of those moves and roll-ups. Reads: the World area or
 * knk.economy.admin; the health card's roll-up needs knk.economy.admin.
 */
export const StockLedgerPage: React.FC = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const state = useMemo(() => readLedgerState(params), [params]);
    const here = buildReturnTo(location);
    const [draft, setDraft] = useState<Record<string, string>>(state.filters);
    const [transactions, setTransactions] = useState<StockTransactionListDto[]>([]);
    const [moves, setMoves] = useState<StockMoveDto[]>([]);
    const [rollups, setRollups] = useState<StockMoveRollupDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lineSum, setLineSum] = useState<LineSum | null>(null);

    useEffect(() => setDraft(state.filters), [state.filters]);

    const go = useCallback((next: LedgerState) => navigate({ pathname: location.pathname, search: ledgerSearch(next) }), [navigate, location.pathname]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const query = ledgerQuery(state, PAGE_SIZE);
                if (state.view === 'transactions') {
                    const page = await stockTransactionClient.searchTransactions(query);
                    if (!cancelled) { setTransactions(page.items ?? []); setTotal(page.totalCount ?? 0); }
                } else if (state.view === 'moves') {
                    const page = await stockTransactionClient.searchMoves(query);
                    if (!cancelled) { setMoves(page.items ?? []); setTotal(page.totalCount ?? 0); }
                } else {
                    const page = await stockTransactionClient.searchRollups(query);
                    if (!cancelled) { setRollups(page.items ?? []); setTotal(page.totalCount ?? 0); }
                }
            } catch (err) {
                if (!cancelled) setError(stockRefusalReason(err) ?? "Couldn't load the ledger.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [state]);

    // The drill-down: a storage + blueprint shows the line's amount next to the net of its moves and roll-ups.
    const storageId = state.filters.storageId;
    const blueprintId = state.filters.itemBlueprintId;
    const onlyLineFilters = Object.keys(state.filters).every(k => k === 'storageId' || k === 'itemBlueprintId');
    useEffect(() => {
        setLineSum(null);
        if (!storageId || !blueprintId || !onlyLineFilters) return;
        let cancelled = false;
        (async () => {
            try {
                const filters = { storageId, itemBlueprintId: blueprintId };
                const [storage, movePage, rollupPage] = await Promise.all([
                    storageClient.getById(Number(storageId)),
                    stockTransactionClient.searchMoves({ pageNumber: 1, pageSize: SUM_PAGE_SIZE, sortDescending: true, filters }),
                    stockTransactionClient.searchRollups({ pageNumber: 1, pageSize: SUM_PAGE_SIZE, sortDescending: true, filters }),
                ]);
                const sid = Number(storageId);
                const line = storage.lines?.find(l => l.itemBlueprintId === Number(blueprintId));
                let movesIn = 0;
                let movesOut = 0;
                for (const m of movePage.items ?? []) {
                    const s = signedAmount(m, sid);
                    if (s > 0) movesIn += s; else movesOut -= s;
                }
                const rollupNet = (rollupPage.items ?? []).reduce((sum, r) => sum + signedAmount(r, sid), 0);
                if (!cancelled) {
                    setLineSum({
                        lineAmount: line?.amount ?? 0,
                        blueprintName: line?.itemBlueprintName ?? movePage.items?.[0]?.itemBlueprintName ?? null,
                        storageName: storage.name ?? null,
                        movesIn,
                        movesOut,
                        rollups: rollupNet,
                        movesCounted: movePage.items?.length ?? 0,
                        movesTotal: movePage.totalCount ?? 0,
                        rollupsCounted: rollupPage.items?.length ?? 0,
                        rollupsTotal: rollupPage.totalCount ?? 0,
                    });
                }
            } catch {
                if (!cancelled) setLineSum(null);
            }
        })();
        return () => { cancelled = true; };
    }, [storageId, blueprintId, onlyLineFilters]);

    const apply = (e: React.FormEvent) => {
        e.preventDefault();
        const filters: Record<string, string> = {};
        for (const [k, v] of Object.entries(draft)) if (v?.trim()) filters[k] = v.trim();
        go({ view: state.view, filters, page: 1 });
    };

    const storageLink = (id: number, name?: string | null) => (
        <Link to={displayPath('Storage', id, here)} className="text-primary hover:underline">{name ?? `Storage #${id}`}</Link>
    );
    const txLink = (id: number) => (
        <Link to={displayPath('StockTransaction', id, here)} className="text-primary hover:underline">#{id}</Link>
    );
    const shownFields = FILTER_FIELDS.filter(f => LEDGER_FILTER_KEYS[state.view].includes(f.key));
    const sid = storageId ? Number(storageId) : null;
    const net = lineSum ? lineSum.movesIn - lineSum.movesOut + lineSum.rollups : 0;
    const complete = lineSum ? lineSum.movesCounted >= lineSum.movesTotal && lineSum.rollupsCounted >= lineSum.rollupsTotal : false;

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div>
                <h1 className="flex items-center text-2xl font-bold text-fg">
                    <ScrollText className="mr-2 h-6 w-6" aria-hidden="true" />
                    Stock ledger
                </h1>
                <p className="mt-1 text-sm text-muted">
                    Every stock transaction and move between storages, and the daily roll-ups of production moves older than 30 days.
                    Filter by storage, blueprint, reason, actor or reference; a number on a storage page opens the moves that made it.
                </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Ledger view">
                {(Object.keys(VIEW_LABELS) as LedgerView[]).map(view => (
                    <button key={view} type="button" aria-pressed={state.view === view}
                        className={state.view === view ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
                        onClick={() => go({ view, filters: state.filters, page: 1 })}>
                        {VIEW_LABELS[view]}
                    </button>
                ))}
            </div>

            <form className="panel grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ledger filters" onSubmit={apply}>
                {shownFields.map(field => (
                    <div key={field.key}>
                        <label htmlFor={`ledger-${field.key}`} className="mb-1 block text-sm font-medium text-fg">{field.label}</label>
                        {field.type === 'reason' ? (
                            <select id={`ledger-${field.key}`} className="input w-full px-3 py-2" value={draft[field.key] ?? ''}
                                onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))}>
                                <option value="">Any</option>
                                {STOCK_REASONS.map(r => <option key={r} value={r}>{enumLabel(r)}</option>)}
                            </select>
                        ) : (
                            <input id={`ledger-${field.key}`} className="input w-full px-3 py-2"
                                type={field.type === 'date' ? 'date' : 'text'} inputMode={field.type === 'id' ? 'numeric' : undefined}
                                value={draft[field.key] ?? ''} onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))} />
                        )}
                    </div>
                ))}
                <div className="flex items-end gap-2">
                    <button type="submit" className="btn-primary text-sm">Apply filters</button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => go({ view: state.view, filters: {}, page: 1 })}>Clear</button>
                </div>
            </form>

            {lineSum && (
                <section className="panel p-4 text-sm" aria-label="Line and its moves" data-testid="ledger-line-sum">
                    <p className="text-fg">
                        <strong>{lineSum.blueprintName ?? `Blueprint #${blueprintId}`}</strong> in{' '}
                        {storageLink(Number(storageId), lineSum.storageName)}: line amount{' '}
                        <strong data-testid="ledger-line-amount">{formatNumber(lineSum.lineAmount)}</strong>
                    </p>
                    <p className="text-fg" data-testid="ledger-line-net">
                        Moves in {formatNumber(lineSum.movesIn)} − moves out {formatNumber(lineSum.movesOut)}
                        {lineSum.rollupsTotal > 0 ? ` + roll-ups ${formatNumber(lineSum.rollups)}` : ''} = {formatNumber(net)}
                        {complete
                            ? (net === lineSum.lineAmount ? ' (matches the line)' : ' (does not match the line: run the reconciler)')
                            : ` (newest ${formatNumber(lineSum.movesCounted)} of ${formatNumber(lineSum.movesTotal)} moves only)`}
                    </p>
                </section>
            )}

            <section className="panel p-4" aria-label={VIEW_LABELS[state.view]}>
                {error && <p className="text-sm field-error" role="alert">{error}</p>}
                {loading && <p className="text-sm text-muted">Loading…</p>}
                {!loading && !error && total === 0 && <p className="text-sm text-muted">Nothing matches these filters.</p>}
                {!error && total > 0 && state.view === 'transactions' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm" aria-label="Stock transactions">
                            <thead>
                                <tr className="text-left text-muted">
                                    {['Transaction', 'When', 'Reason', 'Actor', 'Moves', 'Amount', 'Source', 'Note'].map(h => <th key={h} className="py-1 pr-4 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id} className="border-t border-line">
                                        <td className="py-1 pr-4">{txLink(t.id)}{t.reversesTransactionId != null ? <span className="text-xs text-muted"> reverses #{t.reversesTransactionId}</span> : null}</td>
                                        <td className="py-1 pr-4">{formatDateTime(t.createdAt)}</td>
                                        <td className="py-1 pr-4">{enumLabel(t.reason)}</td>
                                        <td className="py-1 pr-4">{t.actorUserId != null ? `User #${t.actorUserId}` : enumLabel(t.actorKind)}{t.actorComponent ? ` (${t.actorComponent})` : ''}</td>
                                        <td className="py-1 pr-4">{formatNumber(t.moveCount)}</td>
                                        <td className="py-1 pr-4">{formatNumber(t.totalAmount)}</td>
                                        <td className="py-1 pr-4">{t.sourceType ? `${t.sourceType}${t.sourceRef ? ` ${t.sourceRef}` : ''}` : '-'}</td>
                                        <td className="py-1 pr-4">{t.note ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!error && total > 0 && state.view === 'moves' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm" aria-label="Stock moves">
                            <thead>
                                <tr className="text-left text-muted">
                                    {['Transaction', 'When', 'Reason', 'From', 'To', 'Item', sid != null ? 'Amount (± this storage)' : 'Amount'].map(h => <th key={h} className="py-1 pr-4 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {moves.map(m => (
                                    <tr key={m.id} className="border-t border-line">
                                        <td className="py-1 pr-4">{txLink(m.transactionId)}</td>
                                        <td className="py-1 pr-4">{formatDateTime(m.createdAt)}</td>
                                        <td className="py-1 pr-4">{enumLabel(m.reason)}</td>
                                        <td className="py-1 pr-4">{storageLink(m.fromStorageId, m.fromStorageName)}</td>
                                        <td className="py-1 pr-4">{storageLink(m.toStorageId, m.toStorageName)}</td>
                                        <td className="py-1 pr-4">
                                            {m.itemInstanceId != null ? `Item #${m.itemInstanceId}${m.itemBlueprintName ? ` (${m.itemBlueprintName})` : ''}` : m.itemBlueprintName ?? `Blueprint #${m.itemBlueprintId}`}
                                        </td>
                                        <td className="py-1 pr-4">{sid != null ? formatNumber(signedAmount(m, sid), { signDisplay: 'exceptZero' }) : formatNumber(m.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!error && total > 0 && state.view === 'rollups' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm" aria-label="Roll-ups">
                            <thead>
                                <tr className="text-left text-muted">
                                    {['Day', 'Reason', 'From', 'To', 'Blueprint', 'Amount', 'Moves', 'Rolled up'].map(h => <th key={h} className="py-1 pr-4 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rollups.map(r => (
                                    <tr key={r.id} className="border-t border-line">
                                        <td className="py-1 pr-4">{formatDate(r.day, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</td>
                                        <td className="py-1 pr-4">{enumLabel(r.reason)}</td>
                                        <td className="py-1 pr-4">{storageLink(r.fromStorageId, r.fromStorageName)}</td>
                                        <td className="py-1 pr-4">{storageLink(r.toStorageId, r.toStorageName)}</td>
                                        <td className="py-1 pr-4">{r.itemBlueprintName ?? `Blueprint #${r.itemBlueprintId}`}</td>
                                        <td className="py-1 pr-4">{formatNumber(r.amount)}</td>
                                        <td className="py-1 pr-4">{formatNumber(r.moveCount)}</td>
                                        <td className="py-1 pr-4">{formatDateTime(r.rolledUpAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {total > PAGE_SIZE && (
                    <Pager page={state.page} pageSize={PAGE_SIZE} totalCount={total} disabled={loading}
                        onPageChange={page => go({ ...state, page })} className="mt-3" />
                )}
            </section>

            <StockLedgerHealthCard />
        </div>
    );
};

export default StockLedgerPage;
