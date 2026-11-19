import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../Dialog';
import { stockTransactionClient } from '../../apiClients/stockTransactionClient';
import {
    STOCK_REASONS,
    StockMoveMode,
    StockMoveRequestDto,
    StockReason,
    StockResultDto,
} from '../../types/dtos/stock/StockDtos';
import { enumLabel, newIdempotencyKey, stockRefusalReason } from '../../utils/stock';
import { LookupPick, LookupPicker } from './LookupPicker';
import { StockResultView } from './StockResultView';

interface LineDraft {
    key: number;
    from: LookupPick | null;
    to: LookupPick | null;
    unique: boolean;
    blueprint: LookupPick | null;
    instanceId: string;
    amount: string;
}

interface Props {
    open: boolean;
    /** The storage the dialog was opened from: the first line's source. */
    storage: LookupPick;
    /** A stock line's blueprint (the line's Move button). */
    blueprint?: LookupPick | null;
    onClose: () => void;
    onApplied: (result: StockResultDto) => void;
}

/** Manual moves pick their reason; Correction is written by Reverse only, Admin adjust by the adjust dialog. */
const MANUAL_REASONS = STOCK_REASONS.filter(reason => reason !== 'Correction' && reason !== 'AdminAdjust');

let nextLineKey = 1;
const blankLine = (from: LookupPick | null, blueprint: LookupPick | null): LineDraft =>
    ({ key: nextLineKey++, from, to: null, unique: false, blueprint, instanceId: '', amount: '' });

function lineProblem(line: LineDraft): string | null {
    if (!line.from || !line.to) return 'Pick both storages.';
    if (line.from.id === line.to.id) return 'From and to must differ.';
    if (line.unique) return /^\d+$/.test(line.instanceId.trim()) ? null : 'An item instance id.';
    if (!line.blueprint) return 'Pick a blueprint.';
    return /^\d+$/.test(line.amount.trim()) && Number(line.amount) > 0 ? null : 'An amount above 0 (raw units).';
}

/**
 * The manual move dialog (PandiO/knk-workspace#675, IMPLEMENTATION_PLAN § P1, DESIGN § 4.5): one or more lines between
 * storages in one transaction with one reason, all-or-nothing or partial. Refusals (capacity, missing stock, locks) are
 * shown per line from the 200 result. The idempotency key stays the same until the request changes.
 */
export const StockMoveDialog: React.FC<Props> = ({ open, storage, blueprint, onClose, onApplied }) => {
    const [reason, setReason] = useState<StockReason>('Distribution');
    const [mode, setMode] = useState<StockMoveMode>('AllOrNothing');
    const [lines, setLines] = useState<LineDraft[]>(() => [blankLine(storage, blueprint ?? null)]);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<StockResultDto | null>(null);
    const [key, setKey] = useState(() => newIdempotencyKey('move'));

    useEffect(() => {
        if (!open) return;
        setReason('Distribution');
        setMode('AllOrNothing');
        setLines([blankLine(storage, blueprint ?? null)]);
        setNote('');
        setError(null);
        setResult(null);
    }, [open, storage, blueprint]);

    const problems = lines.map(lineProblem);
    const canSubmit = !busy && lines.length > 0 && problems.every(p => p === null);

    const request: StockMoveRequestDto = useMemo(() => ({
        reason,
        mode,
        note: note.trim() || null,
        lines: lines.map(line => ({
            fromStorageId: line.from?.id ?? 0,
            toStorageId: line.to?.id ?? 0,
            itemBlueprintId: line.unique ? null : line.blueprint?.id ?? null,
            itemInstanceId: line.unique && /^\d+$/.test(line.instanceId.trim()) ? Number(line.instanceId.trim()) : null,
            amount: line.unique ? 1 : Number(line.amount) || 0,
        })),
    }), [reason, mode, note, lines]);

    useEffect(() => {
        setKey(newIdempotencyKey('move'));
    }, [request]);

    const names = useMemo(() => {
        const map: Record<number, string> = {};
        for (const line of lines) {
            if (line.from) map[line.from.id] = line.from.label;
            if (line.to) map[line.to.id] = line.to.label;
        }
        return map;
    }, [lines]);

    const update = (lineKey: number, change: Partial<LineDraft>) =>
        setLines(previous => previous.map(line => line.key === lineKey ? { ...line, ...change } : line));

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const answer = await stockTransactionClient.move({ ...request, idempotencyKey: key });
            setResult(answer);
            if (answer.status !== 'Rejected') onApplied(answer);
        } catch (err) {
            setError(stockRefusalReason(err) ?? 'The move could not be sent.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!busy}
            title="Move stock"
            description="One transaction with one reason. All or nothing moves every line in full or nothing; Partial moves what fits and reports the rest."
            size="3xl"
            footer={(
                <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={busy}>{result ? 'Close' : 'Cancel'}</button>
                    <button type="submit" form="stock-move-form" className="btn-primary text-sm" disabled={!canSubmit}>Move</button>
                </div>
            )}
        >
            <form id="stock-move-form" aria-label="Move" className="space-y-4" onSubmit={e => { e.preventDefault(); if (canSubmit) void submit(); }}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="stock-move-reason" className="mb-1 block text-sm font-medium text-fg">Reason</label>
                        <select id="stock-move-reason" className="input w-full px-3 py-2" value={reason} disabled={busy}
                            onChange={e => setReason(e.target.value as StockReason)}>
                            {MANUAL_REASONS.map(r => <option key={r} value={r}>{enumLabel(r)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="stock-move-mode" className="mb-1 block text-sm font-medium text-fg">Mode</label>
                        <select id="stock-move-mode" className="input w-full px-3 py-2" value={mode} disabled={busy}
                            onChange={e => setMode(e.target.value as StockMoveMode)}>
                            <option value="AllOrNothing">All or nothing</option>
                            <option value="Partial">Partial</option>
                        </select>
                    </div>
                </div>
                <ol className="space-y-3" aria-label="Lines">
                    {lines.map((line, index) => (
                        <li key={line.key} className="rounded border border-line p-3" aria-label={`Line ${index + 1}`}>
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-fg">Line {index + 1}</span>
                                {lines.length > 1 && (
                                    <button type="button" className="btn-secondary text-xs" disabled={busy}
                                        onClick={() => setLines(previous => previous.filter(l => l.key !== line.key))}>
                                        <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />Remove line {index + 1}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <LookupPicker entityType="Storage" label="From storage" value={line.from} disabled={busy}
                                    onChange={from => update(line.key, { from })} excludeIds={line.to ? [line.to.id] : undefined} />
                                <LookupPicker entityType="Storage" label="To storage" value={line.to} disabled={busy}
                                    onChange={to => update(line.key, { to })} excludeIds={line.from ? [line.from.id] : undefined} />
                                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                                    <input type="checkbox" checked={line.unique} disabled={busy} onChange={e => update(line.key, { unique: e.target.checked })} />
                                    Unique item (by item instance id)
                                </label>
                                {line.unique ? (
                                    <div>
                                        <label htmlFor={`stock-move-instance-${line.key}`} className="mb-1 block text-sm font-medium text-fg">Item instance id</label>
                                        <input id={`stock-move-instance-${line.key}`} className="input w-full px-3 py-2" inputMode="numeric"
                                            value={line.instanceId} disabled={busy} onChange={e => update(line.key, { instanceId: e.target.value })} />
                                    </div>
                                ) : (
                                    <>
                                        <LookupPicker entityType="ItemBlueprint" label="Blueprint" value={line.blueprint} disabled={busy}
                                            onChange={picked => update(line.key, { blueprint: picked })} />
                                        <div>
                                            <label htmlFor={`stock-move-amount-${line.key}`} className="mb-1 block text-sm font-medium text-fg">Amount (raw units)</label>
                                            <input id={`stock-move-amount-${line.key}`} className="input w-full px-3 py-2" inputMode="numeric"
                                                value={line.amount} disabled={busy} onChange={e => update(line.key, { amount: e.target.value })} />
                                        </div>
                                    </>
                                )}
                            </div>
                            {problems[index] && <p className="mt-2 text-xs text-muted">{problems[index]}</p>}
                        </li>
                    ))}
                </ol>
                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setLines(previous => [...previous, blankLine(storage, null)])}>
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />Add line
                </button>
                <div>
                    <label htmlFor="stock-move-note" className="mb-1 block text-sm font-medium text-fg">Note</label>
                    <textarea id="stock-move-note" className="input w-full px-3 py-2" rows={2} value={note} disabled={busy} onChange={e => setNote(e.target.value)} />
                </div>
                {error && <p className="text-sm field-error" role="alert">{error}</p>}
                {result && <StockResultView result={result} storageNames={names} />}
            </form>
        </Dialog>
    );
};

export default StockMoveDialog;
