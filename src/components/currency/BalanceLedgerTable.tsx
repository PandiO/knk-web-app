import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Loader2, Search } from 'lucide-react';
import { currencyClient } from '../../apiClients/currencyClient';
import { LedgerLineDto, LedgerPageDto, LedgerQuery, LedgerSortKey } from '../../types/dtos/currency/CurrencyDtos';

const numberFormat = new Intl.NumberFormat('en-US');

/** The API sends UTC, sometimes without an offset. */
export const parseUtc = (value: string): Date => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);

const formatWhen = (value: string): string => {
  const date = parseUtc(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const currencyName = (currency: string): string =>
  currency === 'Experience' ? 'XP' : currency.toLowerCase();

/** "moderator" for a staff member or player, "SalaryService" for a system component. */
export const initiatorName = (line: Pick<LedgerLineDto, 'initiator' | 'initiatorUsername' | 'initiatorComponent'>): string =>
  line.initiatorUsername ?? line.initiatorComponent ?? (line.initiator === 'PluginService' ? 'Game server' : line.initiator);

/** A yyyy-mm-dd date input as the UTC instant of that local midnight (plus `days`). */
const dayStart = (value: string, days = 0): string | undefined => {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d + days).toISOString();
};

type Filters = {
  currency: '' | 'coins' | 'gems' | 'xp';
  recipient: string;
  initiator: string;
  source: string;
  reason: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = { currency: '', recipient: '', initiator: '', source: '', reason: '', from: '', to: '' };

const COLUMNS: { key: LedgerSortKey; label: string; align?: 'right'; playerOnly?: boolean }[] = [
  { key: 'createdAt', label: 'Date / time' },
  { key: 'recipient', label: 'Player', playerOnly: true },
  { key: 'currency', label: 'Currency' },
  { key: 'operation', label: 'Operation' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'balanceAfter', label: 'Before → after', align: 'right' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'reason', label: 'Reason' },
];

type Props = {
  /** Only this player's rows (the profile's Balance history); hides the player column and filter. */
  userId?: number;
  pageSize?: number;
  /** Change it to reload the current page (e.g. after an adjustment on the same screen). */
  refreshToken?: number;
};

/**
 * The staff balance event log (KNG-23, currency-payments Phase 4): every change to players'
 * coins, gems and XP from GET api/currency/admin/ledger, one row per player and currency, with
 * the balance before and after, the initiator (staff member or system component) and the reason.
 * Filtering, sorting (click a column header; newest first by default) and paging all happen on
 * the server. Each row links to its transaction, where it can be reversed.
 */
export const BalanceLedgerTable: React.FC<Props> = ({ userId, pageSize = 25, refreshToken = 0 }) => {
  const [draft, setDraft] = React.useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = React.useState<LedgerSortKey>('createdAt');
  const [dir, setDir] = React.useState<'asc' | 'desc'>('desc');
  const [page, setPage] = React.useState(1);
  const [ledger, setLedger] = React.useState<LedgerPageDto | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const query = React.useMemo<LedgerQuery>(() => ({
    userId,
    currency: filters.currency || undefined,
    recipient: userId ? undefined : filters.recipient,
    initiator: filters.initiator,
    source: filters.source,
    reason: filters.reason,
    from: dayStart(filters.from),
    to: dayStart(filters.to, 1),
    sort,
    dir,
    page,
    pageSize,
  }), [userId, filters, sort, dir, page, pageSize]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    currencyClient.getLedger(query)
      .then(result => { if (!cancelled) setLedger(result); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error && err.message ? err.message : 'Could not load the balance log.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, refreshToken]);

  const applyFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(draft);
  };

  // Selects and dates apply at once; text fields on Enter or Search.
  const applyNow = (patch: Partial<Filters>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    applyFilters({ ...filters, ...patch });
  };

  const onSort = (key: LedgerSortKey) => {
    if (key === sort) {
      setDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(key);
      setDir(key === 'createdAt' || key === 'amount' || key === 'balanceAfter' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const columns = COLUMNS.filter(c => !(c.playerOnly && userId));
  const totalPages = ledger ? Math.max(1, Math.ceil(ledger.totalCount / pageSize)) : 1;
  const input = 'border border-gray-300 rounded-md px-2 py-1.5 text-sm';

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit} aria-label="Balance log filters">
        <div>
          <label htmlFor="ledger-currency" className="block text-xs text-gray-500 mb-1">Currency</label>
          <select id="ledger-currency" className={input} value={draft.currency}
            onChange={e => applyNow({ currency: e.target.value as Filters['currency'] })}>
            <option value="">All</option>
            <option value="coins">Coins</option>
            <option value="gems">Gems</option>
            <option value="xp">XP</option>
          </select>
        </div>
        {!userId && (
          <div>
            <label htmlFor="ledger-recipient" className="block text-xs text-gray-500 mb-1">Player</label>
            <input id="ledger-recipient" className={`${input} w-36`} value={draft.recipient} placeholder="Name contains"
              onChange={e => setDraft({ ...draft, recipient: e.target.value })} />
          </div>
        )}
        <div>
          <label htmlFor="ledger-initiator" className="block text-xs text-gray-500 mb-1">Initiator</label>
          <input id="ledger-initiator" className={`${input} w-36`} value={draft.initiator} placeholder="Staff or component"
            onChange={e => setDraft({ ...draft, initiator: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ledger-source" className="block text-xs text-gray-500 mb-1">Source</label>
          <input id="ledger-source" className={`${input} w-32`} value={draft.source} placeholder="e.g. SiegeMatch"
            onChange={e => setDraft({ ...draft, source: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ledger-reason" className="block text-xs text-gray-500 mb-1">Reason code</label>
          <input id="ledger-reason" className={`${input} w-32`} value={draft.reason} placeholder="e.g. ADMIN_GRANT"
            onChange={e => setDraft({ ...draft, reason: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ledger-from" className="block text-xs text-gray-500 mb-1">From</label>
          <input id="ledger-from" type="date" className={input} value={draft.from}
            onChange={e => applyNow({ from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ledger-to" className="block text-xs text-gray-500 mb-1">To</label>
          <input id="ledger-to" type="date" className={input} value={draft.to}
            onChange={e => applyNow({ to: e.target.value })} />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          <Search className="h-4 w-4 mr-1" />
          Search
        </button>
        <button type="button" className="text-sm text-gray-500 hover:underline"
          onClick={() => { setDraft(EMPTY_FILTERS); applyFilters(EMPTY_FILTERS); }}>
          Clear
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              {columns.map(c => (
                <th key={c.key} className={`py-2 pr-4 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}
                  aria-sort={sort === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-gray-900" onClick={() => onSort(c.key)}>
                    {c.label}
                    {sort === c.key && (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
              <th className="py-2">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {ledger?.items.map(line => (
              <tr key={line.entryId} className="border-b last:border-b-0 align-top">
                <td className="py-2 pr-4 whitespace-nowrap text-gray-700">{formatWhen(line.createdAt)}</td>
                {!userId && (
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Link to={`/admin/users/${line.userId}`} className="text-primary hover:underline">
                      {line.username ?? `#${line.userId}`}
                    </Link>
                  </td>
                )}
                <td className="py-2 pr-4">{currencyName(line.currency)}</td>
                <td className="py-2 pr-4">{line.operation}</td>
                <td className={`py-2 pr-4 text-right whitespace-nowrap font-semibold ${line.amount > 0 ? 'text-green-700' : line.amount < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                  {line.amount > 0 ? '+' : ''}{numberFormat.format(line.amount)}
                </td>
                <td className="py-2 pr-4 text-right whitespace-nowrap text-gray-700">
                  {numberFormat.format(line.balanceBefore)} → {numberFormat.format(line.balanceAfter)}
                </td>
                <td className="py-2 pr-4">
                  <span className="text-gray-900">{initiatorName(line)}</span>
                  <span className="block text-xs text-gray-500">
                    {line.initiator}{line.initiatorUsername && line.initiatorComponent ? ` · ${line.initiatorComponent}` : ''}
                  </span>
                </td>
                <td className="py-2 pr-4 max-w-xs">
                  <span className="text-gray-900 break-words">
                    {line.kind === 'Transfer' && line.counterpartyUsername
                      ? `${line.amount < 0 ? 'Paid to' : 'Received from'} ${line.counterpartyUsername}`
                      : line.reason}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {line.reasonCode}{line.sourceType ? ` · ${line.sourceType}${line.sourceRef ? ` ${line.sourceRef}` : ''}` : ''}
                  </span>
                </td>
                <td className="py-2 font-mono text-xs">
                  <Link to={`/admin/economy/transactions/${line.publicId}`} className="text-primary hover:underline">{line.publicId}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <div className="flex items-center text-sm text-gray-500 py-3">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading…
          </div>
        )}
        {!loading && ledger && ledger.items.length === 0 && (
          <p className="text-sm text-gray-500 py-3">No balance changes match.</p>
        )}
      </div>

      {ledger && ledger.totalCount > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="px-3 py-1 border rounded disabled:opacity-50" disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}>
            Previous
          </button>
          <span className="text-gray-600">Page {page} of {totalPages} · {numberFormat.format(ledger.totalCount)} rows</span>
          <button type="button" className="px-3 py-1 border rounded disabled:opacity-50" disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default BalanceLedgerTable;
