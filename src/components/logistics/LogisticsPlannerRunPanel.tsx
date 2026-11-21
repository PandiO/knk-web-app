import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { logisticsPlannerRunClient } from '../../apiClients/logisticsPlannerRunClient';
import { LogisticsPlannerRunDto } from '../../types/dtos/production/LogisticsDtos';
import { formatDateTime } from '../../utils/format';
import { productionRefusalReason } from '../../utils/productionEngine';
import { displayPath } from '../../utils/returnTo';
import { LogisticsPlanView } from './LogisticsPlanView';

interface Props {
    runId: number;
    returnTo: string | null;
    refreshKey?: number;
}

/**
 * A stored planner run (PandiO/knk-workspace#686; TOWN_LOGISTICS § 5, A17): when and why it ran, the policy version,
 * the counts and the plan explanation of every consumer line that was at or below its min.
 */
export const LogisticsPlannerRunPanel: React.FC<Props> = ({ runId, returnTo, refreshKey }) => {
    const [run, setRun] = useState<LogisticsPlannerRunDto | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setRun(await logisticsPlannerRunClient.getById(runId));
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the run.");
        }
    }, [runId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="planner-run-heading" data-testid="planner-run">
            <h2 id="planner-run-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <ListChecks className="mr-2 h-5 w-5" aria-hidden="true" />
                Plan explanation
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !run && <p className="text-sm text-muted">Loading the run…</p>}
            {run && (
                <>
                    <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Town</dt>
                            <dd><Link to={displayPath('Town', run.townId, returnTo)} className="text-primary hover:underline">{run.town?.name ?? `#${run.townId}`}</Link></dd></div>
                        <div><dt className="text-muted">Ran</dt><dd data-testid="planner-run-when">{formatDateTime(run.startedAt)} ({run.trigger})</dd></div>
                        <div><dt className="text-muted">Policy</dt>
                            <dd>{run.logisticsPolicyId != null
                                ? <Link to={displayPath('LogisticsPolicy', run.logisticsPolicyId, returnTo)} className="text-primary hover:underline">v{run.policyVersion}</Link>
                                : 'None'}</dd></div>
                        <div><dt className="text-muted">Counts</dt>
                            <dd data-testid="planner-run-counts">
                                {run.demandLines} lines at or below their min, {run.reservationsCreated} reserved, {run.ordersCreated} orders,
                                {' '}{run.reservationsReleased} released, {run.reservationsCollected} collected, {run.shortfalls} short
                            </dd></div>
                    </dl>
                    <LogisticsPlanView label="Plan explanation" entries={run.entries} summary={run.summary} returnTo={returnTo} />
                </>
            )}
        </section>
    );
};

export default LogisticsPlannerRunPanel;
