import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { productionLineClient } from '../../apiClients/productionLineClient';
import { productionCycleRecordClient } from '../../apiClients/productionCycleRecordClient';
import { useActionGate } from '../../hooks/useActionGate';
import { ProductionCycleRecordDto, ProductionLineDto } from '../../types/dtos/production/ProductionEngineDtos';
import { displayPath } from '../../utils/returnTo';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../utils/toast';
import {
    blueprintName,
    formatNumber,
    formatRate,
    inputErrors,
    lineStatusIsProblem,
    lineStatusLabel,
    PRODUCTION_WRITE_NODE,
    productionRefusalReason,
} from '../../utils/productionEngine';
import { LookupPick, LookupPicker } from '../stock/LookupPicker';
import { ProductionCycleTable } from './ProductionCycleTable';

interface Props {
    lineId: number;
    returnTo: string | null;
    onChanged?: () => void;
    refreshKey?: number;
}

interface InputRow {
    key: number;
    blueprint: LookupPick | null;
    amountPerHour: string;
}

let nextKey = 1;

function rowsOf(line: ProductionLineDto): InputRow[] {
    return (line.inputs ?? []).map(input => ({
        key: nextKey++,
        blueprint: { id: input.itemBlueprintId, label: blueprintName(input) },
        amountPerHour: String(input.amountPerHour),
    }));
}

/** The latest cycles of the line shown on its page. */
const CYCLE_PAGE = 20;

/**
 * A production line's state and inputs (PandiO/knk-workspace#678; PRODUCTION_KINDS § 4, decisions D4, A08): its state
 * and the reason, what it has accrued and when it settles next, the inputs it takes per hour of running time from the
 * structure's Input storage (not on the seeded form, G17; the list replaces the stored one when saved), Settle now, and
 * its latest cycles with their trace. Rate, output and switch are edited with the line's seeded form.
 */
export const ProductionLinePanel: React.FC<Props> = ({ lineId, returnTo, onChanged, refreshKey }) => {
    const gate = useActionGate(PRODUCTION_WRITE_NODE);
    const [line, setLine] = useState<ProductionLineDto | null>(null);
    const [rows, setRows] = useState<InputRow[]>([]);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [cycles, setCycles] = useState<ProductionCycleRecordDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const dto = await productionLineClient.getById(lineId);
            setLine(dto);
            setRows(rowsOf(dto));
            setDirty(false);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't load the line.");
            return;
        }
        try {
            const page = await productionCycleRecordClient.search({
                pageNumber: 1, pageSize: CYCLE_PAGE, filters: { productionLineId: String(lineId) },
            });
            setCycles(page.items ?? []);
        } catch {
            setCycles([]);
        }
    }, [lineId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const inputs = rows.map(row => ({ itemBlueprintId: row.blueprint?.id ?? 0, amountPerHour: Number(row.amountPerHour) }));
    const problems = inputErrors(inputs);
    const canEdit = gate.allowed && !busy;

    const change = (key: number, patch: Partial<InputRow>) => {
        setRows(previous => previous.map(row => row.key === key ? { ...row, ...patch } : row));
        setDirty(true);
    };

    const saveInputs = async () => {
        if (!line || problems.length > 0) return;
        setBusy(true);
        setActionError(null);
        try {
            await productionLineClient.update({ id: line.id, inputs });
            toast.success('Inputs saved.');
            await load();
            onChanged?.();
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? "Couldn't save the inputs.");
        } finally {
            setBusy(false);
        }
    };

    const settle = async () => {
        setBusy(true);
        setActionError(null);
        try {
            const result = await productionLineClient.settle(lineId);
            toast.success(result.settled && result.cycle
                ? `Settled: ${result.cycle.accepted} of ${result.cycle.emitted} accepted.`
                : 'Settled: nothing was due.');
            await load();
            onChanged?.();
        } catch (err) {
            setActionError(productionRefusalReason(err) ?? "Couldn't settle the line.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="production-line-heading" data-testid="production-line">
            <h2 id="production-line-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Factory className="mr-2 h-5 w-5" aria-hidden="true" />
                Production line
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !line && <p className="text-sm text-muted">Loading the line…</p>}
            {line && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted">Structure</dt>
                            <dd>
                                {line.productionStructureId
                                    ? <Link to={displayPath('ProductionStructure', line.productionStructureId, returnTo)} className="text-primary hover:underline">
                                        {line.productionStructure?.name ?? `Structure #${line.productionStructureId}`}
                                    </Link>
                                    : '-'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Output</dt>
                            <dd>{blueprintName(line)}, {formatRate(line.configuredRatePerHour)} ({line.rateSource ?? 'Configured'})</dd>
                        </div>
                        <div>
                            <dt className="text-muted">State</dt>
                            <dd className={lineStatusIsProblem(line.status) ? 'font-medium text-warning-strong' : 'text-fg'} data-testid="line-status">
                                {line.enabled === false && line.status !== 'Paused' ? 'Switched off' : lineStatusLabel(line.status)}
                                {line.statusReason ? `: ${line.statusReason}` : ''}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Accrued (not yet emitted)</dt>
                            <dd>{formatNumber(line.accrued, 4)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Last settled</dt>
                            <dd>{formatDateTime(line.lastSettledAt)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Next settle</dt>
                            <dd>{formatDateTime(line.nextSettleAt)}</dd>
                        </div>
                    </dl>

                    <h3 className="mt-6 mb-1 text-base font-semibold text-fg">Inputs</h3>
                    <p className="mb-3 text-sm text-muted">
                        Taken per hour of running time from the structure's Input storage, all or nothing per settle; a line
                        without them waits in "Blocked: inputs missing".
                    </p>
                    {rows.length === 0 && <p className="mb-3 text-sm text-muted">No inputs.</p>}
                    <ul className="space-y-3" aria-label="Inputs">
                        {rows.map((row, index) => (
                            <li key={row.key} className="grid grid-cols-1 gap-2 rounded border border-line p-3 sm:grid-cols-[2fr_10rem_auto] sm:items-end"
                                aria-label={`Input ${index + 1}`}>
                                <LookupPicker entityType="ItemBlueprint" label="Blueprint" value={row.blueprint} disabled={!canEdit} required
                                    onChange={blueprint => change(row.key, { blueprint })} />
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-fg">Per hour</span>
                                    <input type="number" min={0} step="any" className="input w-full px-2 py-2" value={row.amountPerHour}
                                        disabled={!canEdit} onChange={e => change(row.key, { amountPerHour: e.target.value })} />
                                </label>
                                <button type="button" className="btn-secondary text-sm" disabled={!canEdit}
                                    onClick={() => { setRows(previous => previous.filter(r => r.key !== row.key)); setDirty(true); }}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                    {problems.length > 0 && rows.length > 0 && (
                        <ul className="mt-3 list-disc pl-6 text-sm field-error" aria-label="Problems">
                            {problems.map(problem => <li key={problem}>{problem}</li>)}
                        </ul>
                    )}
                    {actionError && <p className="mt-3 text-sm field-error" role="alert">{actionError}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                            onClick={() => { setRows(previous => [...previous, { key: nextKey++, blueprint: null, amountPerHour: '' }]); setDirty(true); }}>
                            Add input
                        </button>
                        <button type="button" className="btn-primary text-sm" disabled={!canEdit || !dirty || problems.length > 0}
                            title={gate.hint ?? undefined} onClick={() => void saveInputs()}>
                            Save inputs
                        </button>
                        <button type="button" className="btn-secondary text-sm" disabled={!canEdit} title={gate.hint ?? undefined}
                            onClick={() => void settle()}>
                            Settle now
                        </button>
                    </div>
                    {gate.hint && <p className="mt-3 text-xs text-muted">Editing and settling: {gate.hint}.</p>}

                    <h3 className="mt-6 mb-2 text-base font-semibold text-fg">Latest cycles</h3>
                    {cycles == null
                        ? <p className="text-sm text-muted">Loading the cycles…</p>
                        : <ProductionCycleTable cycles={cycles} returnTo={returnTo} label="Line cycles" showOutput={false} />}
                </>
            )}
        </section>
    );
};

export default ProductionLinePanel;
