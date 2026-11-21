import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Network } from 'lucide-react';
import { logisticsClient } from '../../apiClients/logisticsClient';
import { logisticsPlannerRunClient } from '../../apiClients/logisticsPlannerRunClient';
import { logisticsPolicyClient } from '../../apiClients/logisticsPolicyClient';
import { useActionGate } from '../../hooks/useActionGate';
import {
    LogisticsPlanDto,
    LogisticsPlannerRunListDto,
    LogisticsPolicyListDto,
    LogisticsReservationListDto,
    TownServiceAreasDto,
    TownSupplyDto,
} from '../../types/dtos/production/LogisticsDtos';
import { formatDateTime } from '../../utils/format';
import { formatNumber, productionRefusalReason } from '../../utils/productionEngine';
import { displayPath, newFormPath } from '../../utils/returnTo';
import { LOGISTICS_NODE, formatDaysOfCover, logisticsSourceLabel, supplyLineIsLow } from '../../utils/logistics';
import { LogisticsPlanView } from './LogisticsPlanView';
import { LogisticsReservationTable } from './LogisticsReservationTable';
import { ReservationReleaseForm } from './ReservationReleaseForm';
import { ServiceAreaTable } from './ServiceAreaTable';

interface Props {
    townId: number;
    townName: string;
    returnTo: string | null;
    refreshKey?: number;
}

/** Recent planner runs shown on the town page. */
const RUN_PAGE_SIZE = 5;

/**
 * A town's logistics (PandiO/knk-workspace#686; TOWN_LOGISTICS § 2-5, decisions D-L1-D-L3, acceptance A17, insight #65
 * town logistics): the policy in force (the town's own, the default template, or none) with Apply a template; the
 * supply across its warehouses per blueprint (stock, held by reserves, reserved, available, inflow and outflow per day,
 * days of cover, and per warehouse); the open reservations with Release; the planner's Dry run (writes nothing, works
 * while production is off) and Run now, each with the explanation per consumer line; the last and next run and recent
 * runs; which warehouse serves each district, the rural territory and each structure. Shown to staff with the World
 * area's node; the API checks the node again.
 */
export const TownLogisticsPanel: React.FC<Props> = ({ townId, townName, returnTo, refreshKey }) => {
    const gate = useActionGate(LOGISTICS_NODE);
    const [supply, setSupply] = useState<TownSupplyDto | null>(null);
    const [areas, setAreas] = useState<TownServiceAreasDto | null>(null);
    const [runs, setRuns] = useState<LogisticsPlannerRunListDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [plan, setPlan] = useState<LogisticsPlanDto | null>(null);
    const [planning, setPlanning] = useState<'dry' | 'run' | null>(null);
    const [planError, setPlanError] = useState<string | null>(null);
    const [releasing, setReleasing] = useState<LogisticsReservationListDto | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [templates, setTemplates] = useState<LogisticsPolicyListDto[] | null>(null);
    const [templateId, setTemplateId] = useState('');
    const [applyReason, setApplyReason] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setSupply(await logisticsClient.townSupply(townId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the town's logistics.");
            return;
        }
        try {
            setAreas(await logisticsClient.serviceAreas(townId));
        } catch {
            setAreas(null);
        }
        try {
            const page = await logisticsPlannerRunClient.search({ pageNumber: 1, pageSize: RUN_PAGE_SIZE, filters: { townId: String(townId) } });
            setRuns(page.items ?? []);
        } catch {
            setRuns(null);
        }
    }, [townId]);

    useEffect(() => {
        if (gate.allowed) void load();
    }, [gate.allowed, load, refreshKey]);

    if (!gate.allowed) return null;

    const runPlanner = async (kind: 'dry' | 'run') => {
        setPlanning(kind);
        setPlanError(null);
        setPlan(null);
        try {
            const result = kind === 'dry' ? await logisticsClient.dryRun(townId) : await logisticsClient.runNow(townId);
            setPlan(result);
            if (kind === 'run') void load();
        } catch (err) {
            setPlanError(productionRefusalReason(err) ?? "Couldn't run the planner.");
        } finally {
            setPlanning(null);
        }
    };

    const openTemplates = async () => {
        setApplyError(null);
        try {
            const page = await logisticsPolicyClient.search({ pageNumber: 1, pageSize: 50, filters: { scope: 'Template' } });
            setTemplates(page.items ?? []);
        } catch (err) {
            setApplyError(productionRefusalReason(err) ?? "Couldn't load the templates.");
        }
    };

    const applyTemplate = async () => {
        if (!templateId) return;
        setApplying(true);
        setApplyError(null);
        try {
            const policy = await logisticsPolicyClient.applyTemplate(Number(templateId), { townId, reason: applyReason.trim() || null });
            setNotice(`Template applied: ${policy.name ?? 'the town policy'} is now v${policy.version}.`);
            setTemplates(null);
            setTemplateId('');
            setApplyReason('');
            void load();
        } catch (err) {
            setApplyError(productionRefusalReason(err) ?? "Couldn't apply the template.");
        } finally {
            setApplying(false);
        }
    };

    const lowLines = supply?.lines.filter(supplyLineIsLow) ?? [];

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="town-logistics-heading" data-testid="town-logistics">
            <h2 id="town-logistics-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Network className="mr-2 h-5 w-5" aria-hidden="true" />
                Town logistics
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !supply && <p className="text-sm text-muted">Loading the town's logistics…</p>}
            {notice && <p className="mb-3 text-sm text-fg" role="status">{notice}</p>}
            {supply && (
                <>
                    {lowLines.length > 0 && (
                        <div className="mb-4 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong" data-testid="town-logistics-low">
                            <p className="flex items-center font-semibold"><AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />Low supply</p>
                            <p>{lowLines.map(line => `${line.itemBlueprintName ?? `#${line.itemBlueprintId}`} (${line.available <= 0 ? 'nothing available' : formatDaysOfCover(line.daysOfCover)})`).join(', ')}</p>
                        </div>
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Policy in force</dt>
                            <dd data-testid="town-logistics-policy">
                                {supply.policyId != null
                                    ? <Link to={displayPath('LogisticsPolicy', supply.policyId, returnTo)} className="text-primary hover:underline">{logisticsSourceLabel(supply.policySource)} (#{supply.policyId})</Link>
                                    : `${logisticsSourceLabel(supply.policySource)}: no reserves or priorities apply`}
                            </dd></div>
                        <div><dt className="text-muted">Warehouses</dt>
                            <dd data-testid="town-logistics-warehouses">
                                {supply.warehouses.length === 0 ? 'None: the planner does not run for this town' : supply.warehouses.map((warehouse, index) => (
                                    <React.Fragment key={warehouse.id}>
                                        {index > 0 && ', '}
                                        <Link to={displayPath('Warehouse', warehouse.id, returnTo)} className="text-primary hover:underline">{warehouse.name ?? `#${warehouse.id}`}</Link>
                                    </React.Fragment>
                                ))}
                            </dd></div>
                        <div><dt className="text-muted">Last run</dt>
                            <dd data-testid="town-logistics-last-run">
                                {supply.lastRun
                                    ? <><Link to={displayPath('LogisticsPlannerRun', supply.lastRun.id, returnTo)} className="text-primary hover:underline">{formatDateTime(supply.lastRun.startedAt)}</Link> ({supply.lastRun.trigger}): {supply.lastRun.summary ?? '-'}</>
                                    : 'Never'}
                            </dd></div>
                        <div><dt className="text-muted">Next run</dt>
                            <dd data-testid="town-logistics-next-run">
                                {!supply.featureEnabled ? 'Production is off: no scheduled runs (a dry run still works)' : supply.nextRunAt ? formatDateTime(supply.nextRunAt) : 'At the next sweep'}
                            </dd></div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <button type="button" className="btn-primary text-sm" disabled={planning != null} onClick={() => void runPlanner('dry')}>
                            {planning === 'dry' ? 'Planning…' : 'Dry run'}
                        </button>
                        <button type="button" className="btn-secondary text-sm" disabled={planning != null || !supply.featureEnabled}
                            title={!supply.featureEnabled ? 'Production is off' : undefined} onClick={() => void runPlanner('run')}>
                            {planning === 'run' ? 'Running…' : 'Run the planner now'}
                        </button>
                        {templates == null && (
                            <button type="button" className="btn-secondary text-sm" onClick={() => void openTemplates()}>Apply a template</button>
                        )}
                        <span className="text-xs text-muted">A dry run shows what a run would reserve and why, and writes nothing.</span>
                    </div>
                    {templates != null && (
                        <div role="group" aria-label="Apply a template" className="mt-3 space-y-2 rounded border border-line p-3 text-sm">
                            {templates.length === 0 ? (
                                <p className="text-muted">No templates yet. <Link to={newFormPath('LogisticsPolicy', returnTo)} className="text-primary hover:underline">Make one</Link> with scope Template.</p>
                            ) : (
                                <>
                                    <label htmlFor="town-logistics-template" className="block font-medium text-fg">Template</label>
                                    <select id="town-logistics-template" className="input px-3 py-2" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                                        <option value="">Pick a template</option>
                                        {templates.map(template => (
                                            <option key={template.id} value={template.id}>
                                                {template.name} ({template.specialization || 'general'}, {template.townSize || 'any size'}{template.isDefaultTemplate ? ', default' : ''}; {template.ruleCount} rules)
                                            </option>
                                        ))}
                                    </select>
                                    <label htmlFor="town-logistics-apply-reason" className="block font-medium text-fg">Reason (optional)</label>
                                    <input id="town-logistics-apply-reason" className="input px-3 py-2" value={applyReason} maxLength={200} onChange={e => setApplyReason(e.target.value)} />
                                    <p className="text-xs text-muted">The template's rules replace the rules of {townName}'s policy as a new version (the old one stays in the history).</p>
                                </>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {templates.length > 0 && (
                                    <button type="button" className="btn-primary text-sm" disabled={!templateId || applying} onClick={() => void applyTemplate()}>
                                        {applying ? 'Applying…' : 'Apply to this town'}
                                    </button>
                                )}
                                <button type="button" className="btn-secondary text-sm" disabled={applying} onClick={() => setTemplates(null)}>Close</button>
                            </div>
                        </div>
                    )}
                    {applyError && <p className="mt-2 text-sm field-error" role="alert">{applyError}</p>}
                    {planError && <p className="mt-2 text-sm field-error" role="alert">{planError}</p>}
                    {plan && (
                        <div className="mt-3 rounded border border-line p-3">
                            <p className="mb-2 text-xs text-muted" data-testid="logistics-plan-meta">
                                {plan.dryRun ? 'Dry run: nothing was written.' : <>Run <Link to={displayPath('LogisticsPlannerRun', plan.runId ?? 0, returnTo)} className="text-primary hover:underline">#{plan.runId}</Link> stored.</>}
                                {' '}Policy: {plan.policyName ? `${plan.policyName} v${plan.policyVersion}` : 'none'} ({logisticsSourceLabel(plan.policySource)}).
                                {!plan.featureEnabled && ' Production is off: the scheduled planner does not run.'}
                            </p>
                            <LogisticsPlanView label={plan.dryRun ? 'Dry run' : 'Planner run'} entries={plan.entries} orders={plan.orders}
                                released={plan.released} collected={plan.collected} warnings={plan.warnings} summary={plan.summary} returnTo={returnTo} />
                        </div>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Supply</h3>
                    <p className="mb-2 text-xs text-muted">Across the town's warehouses. Flows are averaged over the last {supply.consumptionWindowDays} days; days of cover = stock ÷ outflow per day.</p>
                    {supply.lines.length === 0 ? <p className="text-sm text-muted">The warehouses hold nothing.</p> : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Town supply">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Item</th><th className="pr-4 font-medium">Stock</th>
                                        <th className="pr-4 font-medium">Held by reserves</th><th className="pr-4 font-medium">Reserved</th>
                                        <th className="pr-4 font-medium">Available</th><th className="pr-4 font-medium">In / day</th>
                                        <th className="pr-4 font-medium">Out / day</th><th className="pr-4 font-medium">Days of cover</th>
                                        <th className="font-medium">By warehouse</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supply.lines.map(line => (
                                        <tr key={line.itemBlueprintId} className={`border-t border-line ${supplyLineIsLow(line) ? 'text-warning-strong' : ''}`}>
                                            <td className="pr-4 py-1">{line.itemBlueprintName ?? `#${line.itemBlueprintId}`}</td>
                                            <td className="pr-4 py-1">{formatNumber(line.stock, 0)}</td>
                                            <td className="pr-4 py-1">{formatNumber(line.reserveUnits, 0)}</td>
                                            <td className="pr-4 py-1">{formatNumber(line.reserved, 0)}</td>
                                            <td className="pr-4 py-1">{formatNumber(line.available, 0)}</td>
                                            <td className="pr-4 py-1">{formatNumber(line.inflowPerDay, 1)}</td>
                                            <td className="pr-4 py-1">{formatNumber(line.outflowPerDay, 1)}</td>
                                            <td className="pr-4 py-1">{formatDaysOfCover(line.daysOfCover)}</td>
                                            <td className="py-1 text-xs">
                                                {line.warehouses.map(w => `${w.warehouseName ?? `#${w.warehouseId}`}: ${formatNumber(w.stock, 0)} (available ${formatNumber(w.available, 0)})`).join('; ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Open reservations</h3>
                    <LogisticsReservationTable reservations={supply.openReservations} returnTo={returnTo} label="Open reservations"
                        empty="No open reservations." onRelease={reservation => setReleasing(reservation)} />
                    {releasing && (
                        <ReservationReleaseForm reservationId={releasing.id} onCancel={() => setReleasing(null)}
                            onReleased={released => {
                                setReleasing(null);
                                setNotice(`Reservation #${released.id} released.`);
                                void load();
                            }} />
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Service areas</h3>
                    {areas == null ? <p className="text-sm text-muted">Couldn't load the service areas.</p> : (
                        <ServiceAreaTable entries={areas.entries} returnTo={returnTo} label="Service areas" />
                    )}
                    <p className="mt-1 text-xs text-muted">Change them with ServiceArea rules in the town's policy; without one, the nearest warehouse by road serves.</p>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Recent planner runs</h3>
                    {runs == null && <p className="text-sm text-muted">Couldn't load the runs.</p>}
                    {runs != null && runs.length === 0 && <p className="text-sm text-muted">No runs yet.</p>}
                    {runs != null && runs.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Recent planner runs">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Run</th><th className="pr-4 font-medium">Started</th>
                                        <th className="pr-4 font-medium">Trigger</th><th className="pr-4 font-medium">Policy</th>
                                        <th className="pr-4 font-medium">Lines</th><th className="pr-4 font-medium">Reserved</th>
                                        <th className="pr-4 font-medium">Short</th><th className="font-medium">Summary</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {runs.map(run => (
                                        <tr key={run.id} className="border-t border-line">
                                            <td className="pr-4 py-1"><Link to={displayPath('LogisticsPlannerRun', run.id, returnTo)} className="text-primary hover:underline">#{run.id}</Link></td>
                                            <td className="pr-4 py-1">{formatDateTime(run.startedAt)}</td>
                                            <td className="pr-4 py-1">{run.trigger}</td>
                                            <td className="pr-4 py-1">{run.policyVersion != null ? `v${run.policyVersion}` : '-'}</td>
                                            <td className="pr-4 py-1">{run.demandLines}</td>
                                            <td className="pr-4 py-1">{run.reservationsCreated}</td>
                                            <td className="pr-4 py-1">{run.shortfalls}</td>
                                            <td className="py-1">{run.summary ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default TownLogisticsPanel;
