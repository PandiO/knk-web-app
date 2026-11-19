import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../Dialog';
import { stockTransactionClient } from '../../apiClients/stockTransactionClient';
import { StockAdjustRequestDto, StockResultDto } from '../../types/dtos/stock/StockDtos';
import { newIdempotencyKey, stockRefusalReason } from '../../utils/stock';
import { LookupPick, LookupPicker } from './LookupPicker';
import { StockResultView } from './StockResultView';

export interface AdjustPreset {
    /** A stock line's blueprint (the line's Adjust button). */
    blueprint?: LookupPick;
    /** A unique item in this storage (the unit's Take out button): delta −1. */
    itemInstanceId?: number;
}

interface Props {
    open: boolean;
    storageId: number;
    storageName: string;
    preset?: AdjustPreset | null;
    onClose: () => void;
    /** After an applied or partly applied adjustment (the page re-reads the storage). */
    onApplied: (result: StockResultDto) => void;
}

/**
 * The adjust dialog (PandiO/knk-workspace#675, IMPLEMENTATION_PLAN § P1, DESIGN § 4.3): + puts stock into the storage
 * from SYS_ADJUSTMENT, − takes it back out, as one AdminAdjust transaction with the staff member as actor. The note is
 * required. Each request carries an idempotency key that stays the same until a field changes, so pressing Adjust again
 * after a lost answer applies once (the API answers the first result with `replayed`).
 */
export const StockAdjustDialog: React.FC<Props> = ({ open, storageId, storageName, preset, onClose, onApplied }) => {
    const [mode, setMode] = useState<'blueprint' | 'instance'>('blueprint');
    const [blueprint, setBlueprint] = useState<LookupPick | null>(null);
    const [instanceId, setInstanceId] = useState('');
    const [delta, setDelta] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<StockResultDto | null>(null);
    const [key, setKey] = useState(() => newIdempotencyKey('adjust'));

    useEffect(() => {
        if (!open) return;
        setMode(preset?.itemInstanceId != null ? 'instance' : 'blueprint');
        setBlueprint(preset?.blueprint ?? null);
        setInstanceId(preset?.itemInstanceId != null ? String(preset.itemInstanceId) : '');
        setDelta(preset?.itemInstanceId != null ? '-1' : '');
        setNote('');
        setError(null);
        setResult(null);
    }, [open, preset]);

    const parsedDelta = /^[+-]?\d+$/.test(delta.trim()) ? Number(delta.trim()) : NaN;
    const parsedInstance = /^\d+$/.test(instanceId.trim()) ? Number(instanceId.trim()) : NaN;
    const deltaProblem = Number.isNaN(parsedDelta) || parsedDelta === 0
        ? 'A whole number other than 0: + puts stock in, − takes it out.'
        : mode === 'instance' && Math.abs(parsedDelta) !== 1 ? 'A unique item moves one at a time: +1 or −1.' : null;
    const itemProblem = mode === 'blueprint' ? (blueprint ? null : 'Pick a blueprint.') : (Number.isNaN(parsedInstance) ? 'An item instance id.' : null);
    const noteProblem = note.trim() ? null : 'A note is required: why the stock changes.';
    const canSubmit = !busy && !deltaProblem && !itemProblem && !noteProblem;

    const request: StockAdjustRequestDto = useMemo(() => ({
        storageId,
        itemBlueprintId: mode === 'blueprint' ? blueprint?.id ?? null : null,
        itemInstanceId: mode === 'instance' && !Number.isNaN(parsedInstance) ? parsedInstance : null,
        delta: parsedDelta,
        note: note.trim(),
    }), [storageId, mode, blueprint, parsedInstance, parsedDelta, note]);

    // A changed request gets a new key; the same request keeps it (replay instead of a second adjustment).
    useEffect(() => {
        setKey(newIdempotencyKey('adjust'));
    }, [request]);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const answer = await stockTransactionClient.adjust({ ...request, idempotencyKey: key });
            setResult(answer);
            if (answer.status !== 'Rejected') onApplied(answer);
        } catch (err) {
            setError(stockRefusalReason(err) ?? 'The adjustment could not be sent.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!busy}
            title={`Adjust stock of ${storageName}`}
            description="+ puts stock in from SYS_ADJUSTMENT, − takes it back out. Recorded as an Admin adjust transaction with you as actor."
            size="lg"
            footer={(
                <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={busy}>{result ? 'Close' : 'Cancel'}</button>
                    <button type="submit" form="stock-adjust-form" className="btn-primary text-sm" disabled={!canSubmit}>Adjust</button>
                </div>
            )}
        >
            <form id="stock-adjust-form" aria-label="Adjustment" className="space-y-4" onSubmit={e => { e.preventDefault(); if (canSubmit) void submit(); }}>
                <fieldset>
                    <legend className="mb-1 text-sm font-medium text-fg">Item</legend>
                    <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-1">
                            <input type="radio" name="adjust-mode" checked={mode === 'blueprint'} onChange={() => setMode('blueprint')} disabled={busy} />
                            Stackable item (blueprint)
                        </label>
                        <label className="flex items-center gap-1">
                            <input type="radio" name="adjust-mode" checked={mode === 'instance'} onChange={() => setMode('instance')} disabled={busy} />
                            Unique item (item instance)
                        </label>
                    </div>
                </fieldset>
                {mode === 'blueprint'
                    ? <LookupPicker entityType="ItemBlueprint" label="Blueprint" value={blueprint} onChange={setBlueprint} disabled={busy} required />
                    : (
                        <div>
                            <label htmlFor="stock-adjust-instance" className="mb-1 block text-sm font-medium text-fg">Item instance id *</label>
                            <input id="stock-adjust-instance" className="input w-full px-3 py-2" inputMode="numeric" value={instanceId}
                                disabled={busy} onChange={e => setInstanceId(e.target.value)} />
                        </div>
                    )}
                <div>
                    <label htmlFor="stock-adjust-delta" className="mb-1 block text-sm font-medium text-fg">Change (raw units) *</label>
                    <input id="stock-adjust-delta" className="input w-full px-3 py-2" inputMode="numeric" placeholder="+64 or -10" value={delta}
                        disabled={busy} onChange={e => setDelta(e.target.value)} aria-describedby="stock-adjust-delta-hint" />
                    <p id="stock-adjust-delta-hint" className={`mt-1 text-xs ${delta && deltaProblem ? 'field-error' : 'text-muted'}`}>
                        {delta && deltaProblem ? deltaProblem : 'Raw units; capacity counts them × the blueprint\'s storage weight.'}
                    </p>
                </div>
                <div>
                    <label htmlFor="stock-adjust-note" className="mb-1 block text-sm font-medium text-fg">Note *</label>
                    <textarea id="stock-adjust-note" className="input w-full px-3 py-2" rows={2} value={note} disabled={busy}
                        onChange={e => setNote(e.target.value)} aria-describedby="stock-adjust-note-hint" />
                    <p id="stock-adjust-note-hint" className="mt-1 text-xs text-muted">Required: why the stock changes (shown in the ledger).</p>
                </div>
                {error && <p className="text-sm field-error" role="alert">{error}</p>}
                {result && <StockResultView result={result} storageNames={{ [storageId]: storageName }} />}
            </form>
        </Dialog>
    );
};

export default StockAdjustDialog;
