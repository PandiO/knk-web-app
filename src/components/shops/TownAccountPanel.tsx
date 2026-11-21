import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { townAccountClient } from '../../apiClients/townAccountClient';
import { useActionGate } from '../../hooks/useActionGate';
import type { TownAccountDto, TownAccountEntryDto } from '../../types/dtos/production/ShopDtos';
import { formatDateTime } from '../../utils/format';
import { productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { SHOP_NODE, formatCoins, reasonLabel, signedCoins } from '../../utils/shops';

interface Props {
    accountId: number;
    returnTo: string | null;
    refreshKey?: number;
}

const PAGE = 25;

/** Where a town leg came from: a link to the shop for shop purchases and buy-backs. */
function Source({ entry, returnTo }: { entry: TownAccountEntryDto; returnTo: string | null }) {
    const shopId = entry.sourceRef && /^\d+$/.test(entry.sourceRef) && (entry.sourceType === 'ShopPurchase' || entry.sourceType === 'ShopBuyBack')
        ? Number(entry.sourceRef) : null;
    if (shopId != null) return <Link to={displayPath('Shop', shopId, returnTo)} className="text-primary hover:underline">Shop #{shopId}</Link>;
    if (!entry.sourceType) return <>-</>;
    return <>{entry.sourceRef ? `${entry.sourceType} ${entry.sourceRef}` : entry.sourceType}</>;
}

/**
 * A town's account (PandiO/knk-workspace#688; shops DESIGN § 3.1, F2): its balance, whether the balance matches the last
 * town leg of the currency ledger, and every town leg newest first (shop purchases in, buy-backs out) with the balance
 * after, the player (#938: by username), the shop and the goods leg of a sale or buy-back (#938: its stock
 * transaction). Read only: balances change only through the ledger. World area only.
 */
export const TownAccountPanel: React.FC<Props> = ({ accountId, returnTo, refreshKey }) => {
    const gate = useActionGate(SHOP_NODE);
    const [account, setAccount] = useState<TownAccountDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [entries, setEntries] = useState<TownAccountEntryDto[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [ledgerError, setLedgerError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setAccount(await townAccountClient.getById(accountId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the town account.");
        }
    }, [accountId]);

    const loadLedger = useCallback(async (pageNumber: number) => {
        setLedgerError(null);
        try {
            const result = await townAccountClient.ledger(accountId, pageNumber, PAGE);
            setEntries(result.items ?? []);
            setTotal(result.totalCount ?? 0);
        } catch (err) {
            setEntries(null);
            setLedgerError(productionRefusalReason(err) ?? "Couldn't load the ledger.");
        }
    }, [accountId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    useEffect(() => {
        if (gate.allowed) void loadLedger(page);
    }, [gate.allowed, loadLedger, page, refreshKey]);

    if (!gate.allowed) return null;

    const pages = Math.max(1, Math.ceil(total / PAGE));

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="town-account-heading" data-testid="town-account-panel">
            <h2 id="town-account-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Landmark className="mr-2 h-5 w-5" aria-hidden="true" />
                Balance and ledger
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !account && <p className="text-sm text-muted">Loading the account…</p>}
            {account && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-muted">Town</dt>
                        <dd><Link to={displayPath('Town', account.townId, returnTo)} className="text-primary hover:underline">{account.town?.name ?? `Town #${account.townId}`}</Link></dd></div>
                    <div><dt className="text-muted">Balance</dt><dd data-testid="town-account-balance">{formatCoins(account.coins)}</dd></div>
                    <div><dt className="text-muted">Ledger check</dt>
                        <dd data-testid="town-account-reconciled" className={account.reconciled ? '' : 'text-warning-strong'}>
                            {account.reconciled
                                ? 'Matches the last ledger entry'
                                : `Does not match: the ledger says ${formatCoins(account.ledgerBalance ?? 0)}`}
                        </dd></div>
                </dl>
            )}
            <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Ledger</h3>
            {ledgerError && <p className="text-sm field-error" role="alert">{ledgerError}</p>}
            {entries != null && entries.length === 0 && <p className="text-sm text-muted">No entries yet.</p>}
            {entries != null && entries.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm" aria-label="Town account ledger">
                            <thead>
                                <tr className="text-muted">
                                    <th className="pr-4 font-medium">When</th><th className="pr-4 font-medium">Reason</th>
                                    <th className="pr-4 font-medium">Amount</th><th className="pr-4 font-medium">Balance after</th>
                                    <th className="pr-4 font-medium">Player</th><th className="pr-4 font-medium">Source</th>
                                    <th className="pr-4 font-medium">Goods</th><th className="font-medium">Transaction</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.entryId} className="border-t border-line">
                                        <td className="pr-4 py-1">{formatDateTime(entry.createdAt)}</td>
                                        <td className="pr-4 py-1">{reasonLabel(entry.reasonCode)}</td>
                                        <td className={`pr-4 py-1 ${entry.amount < 0 ? 'text-warning-strong' : ''}`}>{signedCoins(entry.amount)}</td>
                                        <td className="pr-4 py-1">{formatCoins(entry.balanceAfter)}</td>
                                        <td className="pr-4 py-1">
                                            {entry.userId != null ? (entry.username ?? `User #${entry.userId}`) : '-'}
                                        </td>
                                        <td className="pr-4 py-1"><Source entry={entry} returnTo={returnTo} /></td>
                                        <td className="pr-4 py-1">
                                            {entry.stockTransactionId != null
                                                ? <Link to={displayPath('StockTransaction', entry.stockTransactionId, returnTo)} className="text-primary hover:underline"
                                                    aria-label={`Stock transaction #${entry.stockTransactionId}`}>#{entry.stockTransactionId}</Link>
                                                : '-'}
                                        </td>
                                        <td className="py-1 font-mono text-xs">{entry.transactionPublicId}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {pages > 1 && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                            <button type="button" className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Newer</button>
                            <span>Page {page} of {pages}</span>
                            <button type="button" className="btn-secondary text-xs" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Older</button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default TownAccountPanel;
