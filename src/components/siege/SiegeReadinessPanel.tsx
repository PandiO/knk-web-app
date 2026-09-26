import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, WifiOff, XCircle } from 'lucide-react';
import { SiegeScenarioClient } from '../../apiClients/siegeScenarioClient';
import { SiegeReadinessIssueDto, SiegeScenarioReadinessDto } from '../../types/dtos/siege/SiegeDtos';

// Readable names for the entity an issue points at (SiegeReadinessIssueDto.entityType).
const ENTITY_LABELS: Record<string, string> = {
    SiegeScenario: 'Scenario',
    SiegeTeam: 'Team',
    SiegeSpawnpoint: 'Spawnpoint',
    SiegeObjective: 'Objective',
    SiegeScenarioGate: 'Gate',
    GateStructure: 'Gate',
    District: 'District',
    Location: 'Location'
};

const SPATIAL_UNAVAILABLE = 'SPATIAL_CHECKS_UNAVAILABLE';

interface Props {
    scenarioId?: string;
    label?: string;
    description?: string;
}

/**
 * Siege Phase 3, verification item 4: the scenario wizard's last step. Shows
 * GET /api/SiegeScenarios/{id}/readiness (DESIGN.md §3.9) for the SAVED scenario - teams, spawnpoints
 * and objectives are saved as soon as their own forms complete, but this wizard's own fields
 * (general, hub, rules, districts, gates) only save on Submit, so the panel says so and offers a
 * re-check.
 */
export const SiegeReadinessPanel: React.FC<Props> = ({ scenarioId, label, description }) => {
    const [readiness, setReadiness] = React.useState<SiegeScenarioReadinessDto | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const numericId = scenarioId ? Number(scenarioId) : NaN;
    const isSaved = Number.isFinite(numericId) && numericId > 0;

    const load = React.useCallback(async () => {
        if (!isSaved) return;
        setLoading(true);
        setError(null);
        try {
            setReadiness(await SiegeScenarioClient.getInstance().getReadiness(numericId));
        } catch (err: any) {
            setReadiness(null);
            setError(err?.message || 'Could not load the readiness check.');
        } finally {
            setLoading(false);
        }
    }, [isSaved, numericId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const header = (
        <div className="flex items-start justify-between gap-3">
            <div>
                <h3 className="text-sm font-semibold text-gray-900">{label || 'Readiness'}</h3>
                {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
            </div>
            {isSaved && (
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="btn-secondary whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Re-check
                </button>
            )}
        </div>
    );

    if (!isSaved) {
        return (
            <div className="space-y-3" data-testid="siege-readiness-panel">
                {header}
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        Submit to save the scenario first. Then open it again (Edit) to add teams, gates and
                        objectives - the readiness check appears here once the scenario exists.
                    </span>
                </div>
            </div>
        );
    }

    const spatialWarning = readiness?.warnings.find(w => w.code === SPATIAL_UNAVAILABLE);
    const otherWarnings = readiness?.warnings.filter(w => w.code !== SPATIAL_UNAVAILABLE) ?? [];

    return (
        <div className="space-y-3" data-testid="siege-readiness-panel">
            {header}

            {loading && !readiness && (
                <div className="flex items-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…
                </div>
            )}

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            {readiness && (
                <>
                    <div
                        className={`rounded-md border p-3 flex items-center gap-2 text-sm font-medium ${
                            readiness.isReady
                                ? 'border-green-300 bg-green-50 text-green-800'
                                : 'border-red-300 bg-red-50 text-red-800'
                        }`}
                    >
                        {readiness.isReady ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                        {readiness.isReady
                            ? 'Ready - this scenario can be put in a lobby rotation.'
                            : `Not ready - ${readiness.errors.length} problem${readiness.errors.length === 1 ? '' : 's'} to fix.`}
                    </div>

                    {readiness.errors.length > 0 && (
                        <IssueList title="Errors (block readiness)" issues={readiness.errors} tone="error" />
                    )}
                    {otherWarnings.length > 0 && (
                        <IssueList title="Warnings (don't block)" issues={otherWarnings} tone="warning" />
                    )}

                    <div
                        className={`rounded-md border p-3 text-xs flex items-start gap-2 ${
                            readiness.spatialChecksRun
                                ? 'border-green-200 bg-green-50 text-green-800'
                                : 'border-amber-300 bg-amber-50 text-amber-800'
                        }`}
                    >
                        {readiness.spatialChecksRun ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <WifiOff className="h-4 w-4 flex-shrink-0" />}
                        <span>
                            {readiness.spatialChecksRun
                                ? 'Spatial checks ran: the hub, spawnpoints and capture points were checked against the town region.'
                                : (spatialWarning?.message ||
                                    'Spatial checks did not run (the Minecraft server/plugin is not reachable). The hub, spawnpoints and capture points were not checked against the town region.')}
                        </span>
                    </div>
                </>
            )}

            <p className="text-xs text-gray-500">
                This checks the saved scenario. Changes on this form's own steps (general, districts, hub,
                rules, rewards, gates) are saved when you press Submit - re-check after that.
            </p>
        </div>
    );
};

const IssueList: React.FC<{ title: string; issues: SiegeReadinessIssueDto[]; tone: 'error' | 'warning' }> = ({ title, issues, tone }) => {
    const Icon = tone === 'error' ? XCircle : AlertTriangle;
    const color = tone === 'error' ? 'text-red-700' : 'text-amber-700';
    return (
        <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">{title}</p>
            <ul className="space-y-1">
                {issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.entityId ?? index}`} className={`flex items-start gap-2 text-sm ${color}`}>
                        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>
                            {issue.message}
                            <span className="ml-2 font-mono text-xs text-gray-500">
                                {issue.code}
                                {issue.entityType && ` · ${ENTITY_LABELS[issue.entityType] ?? issue.entityType}${issue.entityId != null ? ` #${issue.entityId}` : ''}`}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
