import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { currencyClient, LedgerFilter } from '../apiClients/currencyClient';
import { BalancesDto, LedgerLineDto, LedgerPageDto } from '../types/dtos/currency/CurrencyDtos';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_SIZE = 20;
const numberFormat = new Intl.NumberFormat('en-US');

/** The API sends UTC, sometimes without an offset. */
const parseUtc = (value: string): Date => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);

const currencyLabel = (line: LedgerLineDto): string =>
  line.currency === 'Experience' ? 'XP' : line.currency.toLowerCase();

/** "to Bob" / "from Bob" for player payments, else the ledger's reason. */
const describe = (line: LedgerLineDto): string => {
  if (line.kind === 'Transfer') {
    const other = line.counterpartyUsername ?? 'a player';
    return line.amount < 0 ? `Paid to ${other}` : `Received from ${other}`;
  }
  return line.reason || line.reasonCode;
};

/**
 * The logged-in player's own coin, gem and XP history (currency ledger, KNG-21 Phase 3 /
 * KNG-23): every change with its reason and the balance after it, newest first. Read-only -
 * payments between players are made in-game with /pay (currency DESIGN.md §5 Q4).
 */
export const AccountTransactionsPage: React.FC = () => {
  usePageTitle('Transactions');
  const { user } = useAuth();
  const userId = user?.id;
  const [filter, setFilter] = useState<LedgerFilter | ''>('');
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<LedgerPageDto | null>(null);
  const [balances, setBalances] = useState<BalancesDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [history, current] = await Promise.all([
        currencyClient.getTransactions(userId, page, PAGE_SIZE, filter || undefined),
        currencyClient.getBalances(userId),
      ]);
      setLedger(history);
      setBalances(current);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your transactions.');
    } finally {
      setLoading(false);
    }
  }, [userId, page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = ledger ? Math.max(1, Math.ceil(ledger.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <History className="h-6 w-6 mr-2" />
              Transactions
            </h1>
            <Link to="/account" className="text-white text-sm flex items-center hover:underline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Account
            </Link>
          </div>

          <div className="p-6 space-y-6">
            {balances && (
              <div className="flex flex-wrap gap-6 text-sm">
                <span><span className="text-gray-600">Coins:</span> <span className="font-semibold">{numberFormat.format(balances.coins)}</span></span>
                <span><span className="text-gray-600">Gems:</span> <span className="font-semibold">{numberFormat.format(balances.gems)}</span></span>
                <span><span className="text-gray-600">XP:</span> <span className="font-semibold">{numberFormat.format(balances.experiencePoints)}</span></span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label htmlFor="ledger-filter" className="text-sm text-gray-600">Show</label>
              <select
                id="ledger-filter"
                className="border rounded px-2 py-1 text-sm"
                value={filter}
                onChange={e => { setFilter(e.target.value as LedgerFilter | ''); setPage(1); }}
              >
                <option value="">Everything</option>
                <option value="coins">Coins</option>
                <option value="gems">Gems</option>
                <option value="xp">XP</option>
              </select>
              <span className="text-xs text-gray-500 ml-auto">Send coins in-game with /pay &lt;player&gt; &lt;amount&gt;.</span>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            {loading && !ledger && <div className="text-sm text-gray-500">Loading...</div>}

            {ledger && ledger.items.length === 0 && !loading && (
              <div className="text-sm text-gray-500">No transactions yet.</div>
            )}

            {ledger && ledger.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">When (UTC)</th>
                      <th className="py-2 pr-4 text-right">Change</th>
                      <th className="py-2 pr-4">What</th>
                      <th className="py-2 pr-4 text-right">Balance after</th>
                      <th className="py-2">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.items.map(line => (
                      <tr key={line.entryId} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 whitespace-nowrap text-gray-700">
                          {parseUtc(line.createdAt).toISOString().replace('T', ' ').slice(0, 16)}
                        </td>
                        <td className={`py-2 pr-4 text-right whitespace-nowrap font-semibold ${line.amount > 0 ? 'text-green-700' : line.amount < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                          {line.amount > 0 ? '+' : ''}{numberFormat.format(line.amount)} {currencyLabel(line)}
                        </td>
                        <td className="py-2 pr-4 text-gray-800">{describe(line)}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{numberFormat.format(line.balanceAfter)}</td>
                        <td className="py-2 font-mono text-xs text-gray-500">{line.publicId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ledger && ledger.totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="px-3 py-1 border rounded disabled:opacity-50"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Newer
                </button>
                <span className="text-gray-600">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  className="px-3 py-1 border rounded disabled:opacity-50"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                >
                  Older
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountTransactionsPage;
