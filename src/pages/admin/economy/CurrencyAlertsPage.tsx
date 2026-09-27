import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { currencyClient } from '../../../apiClients/currencyClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import { parseUtc } from '../../../components/currency/BalanceLedgerTable';
import {
    CURRENCY_ALERT_RULES,
    CURRENCY_NODES,
    CurrencyAlertDto,
    CurrencyAlertPageDto,
    CurrencyAlertSeverity,
    CurrencyAlertStatus,
    CurrencyReconciliationStatusDto,
} from '../../../types/dtos/currency/CurrencyDtos';

const PAGE_SIZE = 25;
const SEVERITIES: CurrencyAlertSeverity[] = ['Critical', 'High', 'Medium', 'Low'];

const SEVERITY_STYLES: Record<CurrencyAlertSeverity, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Medium: 'bg-amber-50 text-amber-800 border-amber-200',
    Low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const numberFormat = new Intl.NumberFormat('en-US');

const errorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;

const formatWhen = (value?: string | null): string => {
    if (!value) return '';
    const date = parseUtc(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const SeverityBadge: React.FC<{ severity: CurrencyAlertSeverity }> = ({ severity }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.Low}`}>
        {severity}
    </span>
);

/**
 * Staff → Currency alerts (currency-payments Phase 5, DESIGN.md §3.7/§3.9): the findings of the
 * API's currency monitor - reconciliation mismatches (R1/R2), transfer funnels, ping-pong,
 * velocity, large or frequent staff adjustments, unusual mint rates, balance-cap hits and
 * probing (R3–R9) - with a filter, the details of each, and Acknowledge. Also the last
 * reconciliation run (knk.admin.currency.history) and "Run now". Nothing here changes a balance:
 * a mismatch is reported, never corrected; R1 only switches player transfers off, which is turned
 * back on in the currency policy. Needs knk.admin.currency.alerts (StaffRoute node).
 */
export const CurrencyAlertsPage: React.FC = () => {
    const { allowed: canReadHistory } = usePermission(CURRENCY_NODES.history);
    const { allowed: canEditPolicy } = usePermission(CURRENCY_NODES.policy);

    const [status, setStatus] = React.useState<CurrencyAlertStatus>('open');
    const [severity, setSeverity] = React.useState<CurrencyAlertSeverity | ''>('');
    const [rule, setRule] = React.useState('');
    const [page, setPage] = React.useState(1);

    const [alerts, setAlerts] = React.useState<CurrencyAlertPageDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [acking, setAcking] = React.useState<number | null>(null);
    const [ackError, setAckError] = React.useState<string | null>(null);
    const [expanded, setExpanded] = React.useState<number | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setAlerts(await currencyClient.getAlerts({ status, severity, rule, page, pageSize: PAGE_SIZE }));
        } catch (err) {
            setError(errorMessage(err, 'Could not load the currency alerts.'));
        } finally {
            setLoading(false);
        }
    }, [status, severity, rule, page]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const handleAck = async (alert: CurrencyAlertDto) => {
        setAcking(alert.id);
        setAckError(null);
        try {
            const acked = await currencyClient.acknowledgeAlert(alert.id);
            // In the open view the alert leaves the list; elsewhere it shows who handled it.
            await load();
            if (status !== 'open') {
                setAlerts(current => current && {
                    ...current,
                    items: current.items.map(a => (a.id === acked.id ? acked : a)),
                });
            }
        } catch (err) {
            setAckError(errorMessage(err, 'Could not acknowledge the alert.'));
        } finally {
            setAcking(null);
        }
    };

    const totalPages = alerts ? Math.max(1, Math.ceil(alerts.totalCount / Math.max(1, alerts.pageSize))) : 1;
    const openR1 = alerts?.items.some(a => a.rule === 'R1' && !a.ackedAt) ?? false;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <Link to="/admin/users" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Player moderation
                        </Link>
                        <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                            <ShieldAlert className="h-6 w-6 mr-2" />
                            Currency alerts
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            What the currency monitor noticed: balances that disagree with the ledger, money funnelled
                            from new accounts, unusual inflows, large staff grants and more. Nothing is corrected
                            automatically — look into each alert, then acknowledge it.
                        </p>
                    </div>
                    {alerts && (
                        <div className="flex flex-wrap gap-2 items-center" aria-label="Open alerts by severity">
                            <span className="text-sm text-gray-600">{numberFormat.format(alerts.openCount)} open</span>
                            {SEVERITIES.filter(s => (alerts.openBySeverity[s] ?? 0) > 0).map(s => (
                                <span key={s} className="inline-flex items-center gap-1 text-xs">
                                    <SeverityBadge severity={s} />
                                    {alerts.openBySeverity[s]}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {openR1 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-start gap-2" role="alert">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        <div>
                            A reconciliation mismatch means a balance changed outside the ledger (for example a manual database
                            edit) or a bug. Player payments of the affected currency were switched off automatically.
                            {canEditPolicy && (
                                <> Once it is explained, turn them back on in the <Link to="/admin/economy/policy" className="underline">currency policy</Link>.</>
                            )}
                        </div>
                    </div>
                )}

                {canReadHistory && <ReconciliationPanel />}

                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-end">
                        <div>
                            <label htmlFor="alert-status" className="block text-xs text-gray-500 mb-1">Status</label>
                            <select id="alert-status" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={status}
                                onChange={e => { setStatus(e.target.value as CurrencyAlertStatus); setPage(1); }}>
                                <option value="open">Open</option>
                                <option value="acked">Acknowledged</option>
                                <option value="all">All</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="alert-severity" className="block text-xs text-gray-500 mb-1">Severity</label>
                            <select id="alert-severity" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={severity}
                                onChange={e => { setSeverity(e.target.value as CurrencyAlertSeverity | ''); setPage(1); }}>
                                <option value="">Any</option>
                                {SEVERITIES.map(s => <option key={s} value={s}>{s} and above</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="alert-rule" className="block text-xs text-gray-500 mb-1">Rule</label>
                            <select id="alert-rule" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={rule}
                                onChange={e => { setRule(e.target.value); setPage(1); }}>
                                <option value="">Any</option>
                                {CURRENCY_ALERT_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <button type="button" className="btn-secondary text-sm" onClick={() => void load()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {error && <p className="p-4 text-sm text-red-600">{error}</p>}
                    {ackError && <p className="px-4 pt-4 text-sm text-red-600">{ackError}</p>}
                    {loading && !alerts && (
                        <div className="p-4 flex items-center text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading…
                        </div>
                    )}
                    {alerts && alerts.items.length === 0 && !error && (
                        <p className="p-6 text-sm text-gray-500">
                            {status === 'open' ? 'No open alerts — the monitor has nothing to report.' : 'No alerts match these filters.'}
                        </p>
                    )}

                    {alerts && alerts.items.length > 0 && (
                        <ul className="divide-y divide-gray-100">
                            {alerts.items.map(alert => (
                                <li key={alert.id} className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                <SeverityBadge severity={alert.severity} />
                                                <span className="font-medium text-gray-900">{alert.rule} {alert.ruleName}</span>
                                                <span className="text-gray-400">#{alert.id}</span>
                                                <span className="text-gray-500">{formatWhen(alert.createdAt)}</span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-800 break-words">{alert.summary}</p>
                                            <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
                                                {alert.userId != null && (
                                                    <Link to={`/admin/users/${alert.userId}`} className="text-primary hover:underline">
                                                        Player: {alert.username ?? `#${alert.userId}`}
                                                    </Link>
                                                )}
                                                {alert.transactionPublicId && (
                                                    <Link to={`/admin/economy/transactions/${alert.transactionPublicId}`} className="text-primary hover:underline">
                                                        TX {alert.transactionPublicId}
                                                    </Link>
                                                )}
                                                {alert.details && (
                                                    <button type="button" className="hover:underline"
                                                        onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>
                                                        {expanded === alert.id ? 'Hide details' : 'Details'}
                                                    </button>
                                                )}
                                            </div>
                                            {expanded === alert.id && alert.details && (
                                                <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
                                                    {JSON.stringify(alert.details, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            {alert.ackedAt ? (
                                                <span className="text-xs text-gray-500 inline-flex items-center">
                                                    <Check className="h-4 w-4 mr-1 text-green-600" />
                                                    {alert.ackedByUsername ?? 'Staff'}, {formatWhen(alert.ackedAt)}
                                                </span>
                                            ) : (
                                                <button type="button" className="btn-secondary text-sm" disabled={acking === alert.id}
                                                    onClick={() => void handleAck(alert)} aria-label={`Acknowledge alert ${alert.id}`}>
                                                    {acking === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Acknowledge'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {alerts && alerts.totalCount > alerts.pageSize && (
                        <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                            <span>Page {alerts.pageNumber} of {totalPages} · {numberFormat.format(alerts.totalCount)} alerts</span>
                            <div className="flex gap-2">
                                <button type="button" className="btn-secondary text-sm" disabled={page <= 1 || loading}
                                    onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Previous page">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button type="button" className="btn-secondary text-sm" disabled={page >= totalPages || loading}
                                    onClick={() => setPage(p => p + 1)} aria-label="Next page">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/** The last reconciliation run (users balance columns against the ledger) and "Run now". */
const ReconciliationPanel: React.FC = () => {
    const { allowed: canRun } = usePermission(CURRENCY_NODES.alerts);
    const [state, setState] = React.useState<CurrencyReconciliationStatusDto | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [running, setRunning] = React.useState(false);

    const load = React.useCallback(async () => {
        try {
            setState(await currencyClient.getReconciliation());
            setError(null);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the reconciliation status.'));
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const handleRun = async () => {
        setRunning(true);
        setError(null);
        try {
            const run = await currencyClient.runReconciliation();
            setState(current => ({ ...(current ?? { running: false, monitorEnabled: true, intervalMinutes: 60 }), lastRun: run, running: false }));
        } catch (err) {
            setError(errorMessage(err, 'Could not run the reconciliation.'));
        } finally {
            setRunning(false);
        }
    };

    const last = state?.lastRun;
    return (
        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 space-y-2" aria-label="Reconciliation">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Reconciliation</h2>
                {canRun && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => void handleRun()} disabled={running || state?.running}>
                        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Run now
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500">
                Checks every player's coins, gems and XP against the ledger
                {state ? (state.monitorEnabled ? `, every ${state.intervalMinutes} minutes` : ' (the scheduled run is switched off)') : ''}.
                It only reports: a mismatch becomes a Critical alert and switches payments of that currency off.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {state && !last && <p className="text-sm text-gray-500">No run since the API started.</p>}
            {last && (
                <div className="text-sm">
                    {last.error ? (
                        <p className="text-red-600">The last run ({formatWhen(last.startedAt)}) failed: {last.error}</p>
                    ) : last.mismatchCount === 0 ? (
                        <p className="text-green-700 inline-flex items-center">
                            <Check className="h-4 w-4 mr-1" />
                            Balances reconcile — last run {formatWhen(last.startedAt)} ({last.trigger}, {numberFormat.format(last.durationMs)} ms).
                        </p>
                    ) : (
                        <>
                            <p className="text-red-700">
                                {numberFormat.format(last.mismatchCount)} mismatch{last.mismatchCount === 1 ? '' : 'es'} at {formatWhen(last.startedAt)} ({last.trigger})
                                {last.transfersDisabled.length > 0 && ` — ${last.transfersDisabled.join(', ')} payments switched off`}.
                            </p>
                            <table className="mt-2 text-xs w-full">
                                <thead>
                                    <tr className="text-left text-gray-500">
                                        <th className="py-1 pr-3 font-medium">Kind</th>
                                        <th className="py-1 pr-3 font-medium">Player</th>
                                        <th className="py-1 pr-3 font-medium">Currency</th>
                                        <th className="py-1 pr-3 font-medium text-right">Ledger says</th>
                                        <th className="py-1 pr-3 font-medium text-right">Found</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {last.mismatches.slice(0, 20).map((m, i) => (
                                        <tr key={`${m.kind}-${m.userId}-${m.currency}-${m.entryId ?? m.transactionId ?? i}`} className="border-t border-gray-100">
                                            <td className="py-1 pr-3">{m.kind}</td>
                                            <td className="py-1 pr-3">
                                                {m.userId ? <Link to={`/admin/users/${m.userId}`} className="text-primary hover:underline">#{m.userId}</Link> : '—'}
                                            </td>
                                            <td className="py-1 pr-3">{m.currency}</td>
                                            <td className="py-1 pr-3 text-right">{m.expected != null ? numberFormat.format(m.expected) : '—'}</td>
                                            <td className="py-1 pr-3 text-right">{m.actual != null ? numberFormat.format(m.actual) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {last.mismatchCount > 20 && (
                                <p className="text-xs text-gray-500 mt-1">…and {numberFormat.format(last.mismatchCount - 20)} more (see the alert's details).</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
};

export default CurrencyAlertsPage;
