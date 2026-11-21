import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import { logisticsPolicyClient } from '../../../apiClients/logisticsPolicyClient';
import { LookupPicker, LookupPick } from '../../../components/stock/LookupPicker';
import { LOGISTICS_POLICY_SCOPES, LogisticsPolicyListDto } from '../../../types/dtos/production/LogisticsDtos';
import { formatDateTime } from '../../../utils/format';
import { productionRefusalReason } from '../../../utils/productionEngine';
import { buildReturnTo, dashboardPath, displayPath, newFormPath } from '../../../utils/returnTo';

const PAGE_SIZE = 50;

/** One policy's purpose in words for the list. */
function policyFor(row: LogisticsPolicyListDto): string {
    if (row.scope === 'Town') return `Town: ${row.townName ?? `#${row.townId}`}`;
    if (row.scope === 'Warehouse') return `Warehouse: ${row.warehouseName ?? `#${row.warehouseId}`}`;
    return `Template: ${row.specialization || 'General'}, ${row.townSize || 'any size'}${row.isDefaultTemplate ? ' (default)' : ''}`;
}

/**
 * Town logistics (PandiO/knk-workspace#686; TOWN_LOGISTICS § 4, § 4.1, decision D-L3): the logistics policies of towns
 * and warehouses and the default templates per town size and specialization, filtered by what they are for, with
 * superseded versions on request. A row opens the policy's page (rule editor, versions, Apply to a town). New policy
 * opens the seeded form. Open a town to see its supply, reservations and the planner's dry run.
 */
export const LogisticsPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const here = buildReturnTo(location);
    const [scope, setScope] = useState('');
    const [current, setCurrent] = useState('true');
    const [rows, setRows] = useState<LogisticsPolicyListDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [town, setTown] = useState<LookupPick | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        const filters: Record<string, string> = { current };
        if (scope) filters.scope = scope;
        logisticsPolicyClient.search({ pageNumber: 1, pageSize: PAGE_SIZE, filters })
            .then(result => { if (!cancelled) setRows(result.items ?? []); })
            .catch(err => { if (!cancelled) setError(productionRefusalReason(err) ?? "Couldn't load the policies."); });
        return () => { cancelled = true; };
    }, [scope, current]);

    return (
        <div className="page-container space-y-6">
            <header>
                <h1 className="flex items-center text-2xl font-semibold"><Network className="mr-2 h-6 w-6" aria-hidden="true" />Town logistics</h1>
                <p className="mt-1 text-sm text-muted">
                    Warehouses reserve stock for consumers at or below their min; each consumer's own worker collects it. A town's
                    policy holds its reserves, priority classes, service areas and replenishment defaults; towns without one use the
                    default template. Every save is a new version.
                </p>
            </header>

            <section className="panel p-4 sm:p-6" aria-labelledby="logistics-town-heading">
                <h2 id="logistics-town-heading" className="mb-2 text-lg font-semibold text-fg">A town's supply and planner</h2>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[16rem]"><LookupPicker entityType="Town" label="Town" value={town} onChange={setTown} /></div>
                    <button type="button" className="btn-primary text-sm" disabled={!town} onClick={() => town && navigate(displayPath('Town', town.id, here))}>
                        Open the town
                    </button>
                </div>
            </section>

            <section className="panel p-4 sm:p-6" aria-labelledby="logistics-policies-heading">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <h2 id="logistics-policies-heading" className="text-lg font-semibold text-fg">Policies and templates</h2>
                    <Link to={newFormPath('LogisticsPolicy', here)} className="btn-primary text-sm">New policy or template</Link>
                </div>
                <form aria-label="Policy filters" className="mb-3 flex flex-wrap items-end gap-3 text-sm" onSubmit={e => e.preventDefault()}>
                    <div>
                        <label htmlFor="logistics-filter-scope" className="mb-1 block font-medium text-fg">For</label>
                        <select id="logistics-filter-scope" className="input px-3 py-2" value={scope} onChange={e => setScope(e.target.value)}>
                            <option value="">Towns, warehouses and templates</option>
                            {LOGISTICS_POLICY_SCOPES.map(s => <option key={s} value={s}>{s === 'Template' ? 'Templates' : `${s} policies`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="logistics-filter-current" className="mb-1 block font-medium text-fg">Versions</label>
                        <select id="logistics-filter-current" className="input px-3 py-2" value={current} onChange={e => setCurrent(e.target.value)}>
                            <option value="true">Current only</option>
                            <option value="all">Current and superseded</option>
                            <option value="false">Superseded only</option>
                        </select>
                    </div>
                </form>
                {error && <p className="text-sm field-error" role="alert">{error}</p>}
                {!error && rows == null && <p className="text-sm text-muted">Loading the policies…</p>}
                {rows != null && rows.length === 0 && <p className="text-sm text-muted">No policies yet.</p>}
                {rows != null && rows.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm" aria-label="Logistics policies">
                            <thead>
                                <tr className="text-muted">
                                    <th className="pr-4 font-medium">Policy</th><th className="pr-4 font-medium">For</th>
                                    <th className="pr-4 font-medium">Version</th><th className="pr-4 font-medium">Rules</th>
                                    <th className="pr-4 font-medium">Saved</th><th className="font-medium">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(row => (
                                    <tr key={row.id} className="border-t border-line">
                                        <td className="pr-4 py-1"><Link to={displayPath('LogisticsPolicy', row.id, here)} className="text-primary hover:underline">{row.name}</Link></td>
                                        <td className="pr-4 py-1">{policyFor(row)}</td>
                                        <td className="pr-4 py-1">v{row.version}{row.isCurrent ? '' : ' (superseded)'}</td>
                                        <td className="pr-4 py-1">{row.ruleCount}</td>
                                        <td className="pr-4 py-1">{formatDateTime(row.createdAt)}</td>
                                        <td className="py-1">{row.reason ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <p className="flex flex-wrap gap-x-4 text-sm">
                <Link to={dashboardPath('ConsumerReplenishment')} className="text-primary hover:underline">Consumer settings</Link>
                <Link to={dashboardPath('LogisticsReservation')} className="text-primary hover:underline">Reservations</Link>
                <Link to={dashboardPath('LogisticsPlannerRun')} className="text-primary hover:underline">Planner runs</Link>
                <Link to={dashboardPath('LogisticsRule')} className="text-primary hover:underline">All rules</Link>
            </p>
        </div>
    );
};

export default LogisticsPage;
