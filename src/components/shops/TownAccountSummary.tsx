import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { townAccountClient } from '../../apiClients/townAccountClient';
import { useActionGate } from '../../hooks/useActionGate';
import type { TownAccountDto } from '../../types/dtos/production/ShopDtos';
import { productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { SHOP_NODE, formatCoins } from '../../utils/shops';

interface Props {
    townId: number;
    returnTo: string | null;
    refreshKey?: number;
}

const isNotFound = (err: unknown) => (err as { status?: number } | null)?.status === 404;

/**
 * A town's account on the town page (PandiO/knk-workspace#938; shops DESIGN § 3.1, F2): its coins, whether they match
 * the ledger, and a link to the account's page with the ledger. A town without one yet says it opens with the first
 * shop sale. Read only. World area only, like the account's own page.
 */
export const TownAccountSummary: React.FC<Props> = ({ townId, returnTo, refreshKey }) => {
    const gate = useActionGate(SHOP_NODE);
    const [account, setAccount] = useState<TownAccountDto | 'none' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setAccount(await townAccountClient.getByTown(townId));
        } catch (err) {
            if (isNotFound(err)) setAccount('none');
            else {
                setAccount(null);
                setError(productionRefusalReason(err) ?? "Couldn't load the town's account.");
            }
        }
    }, [townId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    if (!gate.allowed) return null;

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="town-account-summary-heading" data-testid="town-account-summary">
            <h2 id="town-account-summary-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Landmark className="mr-2 h-5 w-5" aria-hidden="true" />
                Town account
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && account === null && <p className="text-sm text-muted">Loading the account…</p>}
            {account === 'none' && <p className="text-sm text-muted">No account yet: it opens with the first shop sale in this town.</p>}
            {account && account !== 'none' && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-muted">Balance</dt><dd data-testid="town-account-summary-coins">{formatCoins(account.coins)}</dd></div>
                    <div><dt className="text-muted">Ledger check</dt>
                        <dd className={account.reconciled ? '' : 'text-warning-strong'}>
                            {account.reconciled ? 'Matches the last ledger entry' : `Does not match: the ledger says ${formatCoins(account.ledgerBalance ?? 0)}`}
                        </dd></div>
                    <div><dt className="text-muted">Ledger</dt>
                        <dd><Link to={displayPath('TownAccount', account.id, returnTo)} className="text-primary hover:underline">Open the ledger</Link></dd></div>
                </dl>
            )}
        </section>
    );
};

export default TownAccountSummary;
