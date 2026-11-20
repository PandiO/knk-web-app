import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Gauge } from 'lucide-react';
import { productionStructureClient } from '../../apiClients/productionStructureClient';
import { productionKindClient } from '../../apiClients/productionKindClient';
import { useActionGate, useAllNodesGate } from '../../hooks/useActionGate';
import {
    ProductionKindLevelDto,
    ProductionOverviewDto,
    ProductionUpgradeResultDto,
} from '../../types/dtos/production/ProductionEngineDtos';
import { dashboardPath, displayPath, newFormPath } from '../../utils/returnTo';
import { toast } from '../../utils/toast';
import {
    blueprintName,
    formatRate,
    lineStatusIsProblem,
    lineStatusLabel,
    nextLevelOf,
    PRODUCTION_UPGRADE_NODES,
    PRODUCTION_WRITE_NODE,
    productionRefusalReason,
    upgradeCostItems,
} from '../../utils/productionEngine';
import { LookupPick, LookupPicker } from '../stock/LookupPicker';
import { ProductionCycleTable } from './ProductionCycleTable';
import { RateBreakdown } from './RateBreakdown';

interface Props {
    structureId: number;
    returnTo: string | null;
    /** After workers or the level changed, so the details above are read again. */
    onChanged?: () => void;
    refreshKey?: number;
}

/** The kind's levels, for the upgrade cost; null when the structure has no kind. */
type NextLevel = { level: ProductionKindLevelDto | null } | null;

/**
 * A production structure's production (PandiO/knk-workspace#678; production DESIGN § 9, § 11.1, PRODUCTION_KINDS § 4-5,
 * acceptance A08, A09, insight #65): why it isn't producing (structure-wide and per line), each line's rate with the
 * modifiers in applied order, the workers present (P5 and the game server send them away), the upgrade to the next
 * level with its cost shown before paying, and the latest cycles with their trace. Reading the view settles the lines
 * first while the feature is on.
 */
export const StructureProductionPanel: React.FC<Props> = ({ structureId, returnTo, onChanged, refreshKey }) => {
    const writeGate = useActionGate(PRODUCTION_WRITE_NODE);
    const upgradeGate = useAllNodesGate(PRODUCTION_UPGRADE_NODES);
    const [overview, setOverview] = useState<ProductionOverviewDto | null>(null);
    const [next, setNext] = useState<NextLevel>(null);
    const [error, setError] = useState<string | null>(null);
    const [workers, setWorkers] = useState('');
    const [payer, setPayer] = useState<LookupPick | null>(null);
    const [payFrom, setPayFrom] = useState<LookupPick | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [upgraded, setUpgraded] = useState<ProductionUpgradeResultDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        let dto: ProductionOverviewDto;
        try {
            dto = await productionStructureClient.getProduction(structureId);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the production.");
            return;
        }
        setOverview(dto);
        setWorkers(String(dto.workersPresent));
        if (dto.productionKind?.id) {
            try {
                const kind = await productionKindClient.getById(dto.productionKind.id);
                setNext({ level: nextLevelOf(kind.levels, dto.level) });
            } catch {
                setNext({ level: null });
            }
        } else {
            setNext(null);
        }
    }, [structureId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setActionError(null);
        try {
            await action();
            await load();
            onChanged?.();
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? 'The change was refused.');
        } finally {
            setBusy(false);
        }
    };

    const workersValue = Number(workers);
    const workersProblem = overview && (workers.trim() === '' || !Number.isInteger(workersValue) || workersValue < 0 || workersValue > overview.workersTotal)
        ? `A whole number from 0 to ${overview.workersTotal}.`
        : null;

    const saveWorkers = () => run(async () => {
        await productionStructureClient.setWorkers(structureId, { workersPresent: workersValue });
        toast.success(`Workers present: ${workersValue}.`);
    });

    const nextLevel = next?.level ?? null;
    const coins = nextLevel?.upgradeCoins ?? 0;
    const costItems = upgradeCostItems(nextLevel);
    const upgradeProblem = coins > 0 && !payer ? 'This level costs coins: pick the player who pays.' : null;

    const upgrade = () => run(async () => {
        const result = await productionStructureClient.upgrade(structureId, {
            payerUserId: payer?.id ?? null,
            payFromStorageId: payFrom?.id ?? null,
        });
        setUpgraded(result);
        setConfirming(false);
        toast.success(`Upgraded to level ${result.toLevel}.`);
    });

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-production-heading" data-testid="structure-production-engine">
            <h2 id="structure-production-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Gauge className="mr-2 h-5 w-5" aria-hidden="true" />
                Production
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !overview && <p className="text-sm text-muted">Loading the production…</p>}
            {overview && (
                <>
                    {overview.notProducingReasons.length > 0 && (
                        <div className="mb-4 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
                            <p className="flex items-center font-semibold">
                                <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />Not producing
                            </p>
                            <ul aria-label="Why it is not producing" className="mt-1 list-disc pl-6">
                                {overview.notProducingReasons.map(reason => <li key={reason}>{reason}</li>)}
                            </ul>
                        </div>
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted">Kind</dt>
                            <dd data-testid="production-kind">
                                {overview.productionKind
                                    ? <Link to={displayPath('ProductionKind', overview.productionKind.id, returnTo)} className="text-primary hover:underline">{overview.productionKind.name}</Link>
                                    : 'None'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Level</dt>
                            <dd data-testid="production-level">{overview.level} of 10</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Climate zone</dt>
                            <dd>{overview.climateZone ?? '-'}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Weather today</dt>
                            <dd data-testid="production-weather">{overview.weatherToday ?? '-'}</dd>
                        </div>
                    </dl>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Lines</h3>
                    {overview.lines.length === 0 && <p className="text-sm text-muted">No production lines.</p>}
                    <ul className="space-y-4" aria-label="Production lines">
                        {overview.lines.map(entry => (
                            <li key={entry.line.id} className="rounded border border-line p-3" aria-label={blueprintName(entry.line)}>
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <Link to={displayPath('ProductionLine', entry.line.id, returnTo)} className="font-medium text-primary hover:underline">
                                        {blueprintName(entry.line)}
                                    </Link>
                                    <span className={lineStatusIsProblem(entry.line.status) ? 'text-sm font-medium text-warning-strong' : 'text-sm text-muted'}
                                        data-testid={`line-${entry.line.id}-status`}>
                                        {lineStatusLabel(entry.line.status)}, {formatRate(entry.effectiveRatePerHour)}
                                    </span>
                                </div>
                                {entry.notProducingReasons.length > 0 && (
                                    <ul aria-label={`Why ${blueprintName(entry.line)} is not producing`} className="mt-2 list-disc pl-6 text-sm text-warning-strong">
                                        {entry.notProducingReasons.map(reason => <li key={reason}>{reason}</li>)}
                                    </ul>
                                )}
                                <div className="mt-2 overflow-x-auto">
                                    <RateBreakdown
                                        label={`Rate of ${blueprintName(entry.line)}`}
                                        baseRatePerHour={entry.baseRatePerHour}
                                        modifiers={entry.modifiers}
                                        unlockFactor={entry.unlockFactor}
                                        workerFactor={entry.workerFactor}
                                        effectiveRatePerHour={entry.effectiveRatePerHour}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                    {writeGate.allowed && (
                        <p className="mt-3 text-sm">
                            <Link to={newFormPath('ProductionLine', returnTo)} className="text-primary hover:underline">Add a production line</Link>
                            <span className="text-muted"> (pick this structure on the form)</span>
                        </p>
                    )}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Workers</h3>
                    <div className="flex flex-wrap items-end gap-2">
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-fg">Workers present (of {overview.workersTotal})</span>
                            <input type="number" min={0} max={overview.workersTotal} step={1} className="input w-32 px-2 py-2" value={workers}
                                disabled={!writeGate.allowed || busy} onChange={e => setWorkers(e.target.value)} />
                        </label>
                        <button type="button" className="btn-secondary text-sm" title={writeGate.hint ?? undefined}
                            disabled={!writeGate.allowed || busy || !!workersProblem || workersValue === overview.workersPresent}
                            onClick={() => void saveWorkers()}>
                            Save workers
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                        {workersProblem ?? 'Output scales with the workers present: one of two away halves it, both away stops it.'}
                    </p>

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Upgrade</h3>
                    {upgraded && (
                        <p className="mb-2 text-sm text-fg" role="status" data-testid="upgrade-result">
                            Upgraded from level {upgraded.fromLevel} to {upgraded.toLevel}
                            {upgraded.coinsPaid > 0 ? `, ${upgraded.coinsPaid} coins paid` : ''}
                            {upgraded.stockTransactionId != null && (
                                <>
                                    {', resources: '}
                                    <Link to={displayPath('StockTransaction', upgraded.stockTransactionId, returnTo)} className="text-primary hover:underline">
                                        transaction #{upgraded.stockTransactionId}
                                    </Link>
                                </>
                            )}
                            .
                        </p>
                    )}
                    {next == null && <p className="text-sm text-muted">Pick a production kind first: the levels come from the kind.</p>}
                    {next != null && !nextLevel && <p className="text-sm text-muted" data-testid="upgrade-top">Level {overview.level} is the highest level.</p>}
                    {nextLevel && (
                        <div className="rounded border border-line p-3" data-testid="upgrade-cost">
                            <p className="text-sm text-fg">
                                Level {nextLevel.level} costs <strong>{coins} coins</strong>
                                {costItems.length > 0
                                    ? <> and {costItems.map(item => `${item.amount} × ${blueprintName(item)}`).join(', ')}</>
                                    : ' and no resources'}
                                .
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <LookupPicker entityType="User" label="Paid by (coins)" value={payer} onChange={setPayer}
                                    disabled={!upgradeGate.allowed || busy} required={coins > 0} />
                                <LookupPicker entityType="Storage" label="Resources from (empty: its Output storage)" value={payFrom} onChange={setPayFrom}
                                    disabled={!upgradeGate.allowed || busy} />
                            </div>
                            {upgradeProblem && <p className="mt-2 text-xs text-muted">{upgradeProblem}</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {!confirming ? (
                                    <button type="button" className="btn-secondary text-sm" title={upgradeGate.hint ?? undefined}
                                        disabled={!upgradeGate.allowed || busy || !!upgradeProblem} onClick={() => setConfirming(true)}>
                                        Upgrade to level {nextLevel.level}
                                    </button>
                                ) : (
                                    <>
                                        <span className="self-center text-sm text-fg">Pay the cost and upgrade now?</span>
                                        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void upgrade()}>
                                            Pay and upgrade
                                        </button>
                                        <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setConfirming(false)}>
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                            {upgradeGate.hint && <p className="mt-2 text-xs text-muted">Upgrading: {upgradeGate.hint}.</p>}
                        </div>
                    )}
                    {actionError && <p className="mt-3 text-sm field-error" role="alert">{actionError}</p>}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Latest cycles</h3>
                    <ProductionCycleTable cycles={overview.recentCycles} returnTo={returnTo} label="Recent cycles" />
                    {/* #838: cycle records are a dashboard list of their own now (filters: structure, line). */}
                    <p className="mt-2 text-sm">
                        <Link to={dashboardPath('ProductionCycleRecord')} className="text-primary hover:underline">All cycle records</Link>
                    </p>
                </>
            )}
        </section>
    );
};

export default StructureProductionPanel;
