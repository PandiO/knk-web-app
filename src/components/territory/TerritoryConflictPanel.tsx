import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { territoryConflictClient } from '../../apiClients/territoryConflictClient';
import { TerritoryConflictDto, TerritoryConflictResolveDto, TerritoryHolderDto } from '../../types/dtos/territory/TerritoryDtos';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { useConfirm } from '../../hooks/useConfirm';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { displayPath } from '../../utils/returnTo';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../utils/toast';
import { conflictAreaLabel, conflictStateLabel, holderLabel } from '../../utils/territory';
import { TERRITORY_WRITE_NODES } from './TownTerritoryPanel';

interface Props {
    conflictId: number;
    /** This page, so a holder's or structure's page comes back here. */
    returnTo: string | null;
    /** Called after a resolve or reopen, so the details above re-read the conflict. */
    onChanged?: () => void;
}

/** The holder's own page: a town, or a kingdom (crown land is held by its kingdom). */
const holderLink = (holder: TerritoryHolderDto, returnTo: string | null) =>
    holder.name
        ? <Link to={displayPath(String(holder.kind), holder.id, returnTo)} className="font-medium text-primary hover:underline">{holderLabel(holder)}</Link>
        : <span className="font-medium text-fg">{holderLabel(holder)}</span>;

/**
 * A territory conflict and its admin resolution (territory DESIGN § 3, acceptance A05; PandiO/knk-workspace#690): the
 * two holders, the contested area, whether the game server still reports the overlap, the structures flagged in it
 * and the resolution. Open: award the area to one holder or mark the lines redrawn (with a note); resolved: reopen.
 * All need knk.admin.world; nothing is resolved automatically.
 */
export const TerritoryConflictPanel: React.FC<Props> = ({ conflictId, returnTo, onChanged }) => {
    const writeGate = useAllNodesGate(TERRITORY_WRITE_NODES);
    const [confirm, confirmModal] = useConfirm();
    const [conflict, setConflict] = useState<TerritoryConflictDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        try {
            setConflict(await territoryConflictClient.getById(conflictId));
        } catch (err) {
            setError(apiRefusalReason(err) ?? "Couldn't load the conflict.");
        }
    }, [conflictId]);

    useEffect(() => {
        setConflict(null);
        void load();
    }, [load]);

    const run = async (action: () => Promise<TerritoryConflictDto>, done: string, failed: string) => {
        setBusy(true);
        try {
            setConflict(await action());
            setNote('');
            toast.success(done);
            onChanged?.();
        } catch (err) {
            toast.error(apiRefusalReason(err) ?? failed);
            await load();
        } finally {
            setBusy(false);
        }
    };

    const resolve = async (body: TerritoryConflictResolveDto, what: string) => {
        if (!conflict) return;
        const ok = await confirm({
            title: `${what}?`,
            message: body.resolution === 'Awarded'
                ? `The contested chunks go to ${holderLabel(body.awardedHolder)}; the game server gets the award with its next rebuild. You can reopen the conflict later.`
                : 'The conflict is closed without an award: use this after changing power, regions or ranges so the overlap is gone. You can reopen it later.',
            confirmLabel: what,
        });
        if (!ok) return;
        await run(
            () => territoryConflictClient.resolve(conflict.id, { ...body, note: note.trim() || null }),
            'Conflict resolved.',
            'The conflict could not be resolved.'
        );
    };

    const reopen = async () => {
        if (!conflict) return;
        const ok = await confirm({
            title: 'Reopen the conflict?',
            message: conflict.resolution === 'Awarded'
                ? 'The award is withdrawn: the area is contested again until an admin resolves it.'
                : 'The conflict is open again until an admin resolves it.',
            confirmLabel: 'Reopen',
        });
        if (!ok) return;
        await run(() => territoryConflictClient.reopen(conflict.id), 'Conflict reopened.', 'The conflict could not be reopened.');
    };

    const open = conflict?.status !== 'Resolved';
    const actionTitle = writeGate.hint ?? undefined;
    const disabled = !writeGate.allowed || busy;

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="territory-conflict-heading" data-testid="territory-conflict">
            <h2 id="territory-conflict-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Swords className="mr-2 h-5 w-5" aria-hidden="true" />
                Contested zone
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !conflict && <p className="text-sm text-muted">Loading the conflict…</p>}
            {conflict && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-muted">Holders</dt>
                            <dd>{holderLink(conflict.holderA, returnTo)} <span className="text-muted">and</span> {holderLink(conflict.holderB, returnTo)}</dd></div>
                        <div><dt className="text-muted">State</dt><dd className="font-medium text-fg" data-testid="conflict-state">{conflictStateLabel(conflict)}</dd></div>
                        <div><dt className="text-muted">World</dt><dd className="text-fg">{conflict.world}</dd></div>
                        <div><dt className="text-muted">Area</dt>
                            <dd className="text-fg">{conflict.chunkCount} chunk{conflict.chunkCount === 1 ? '' : 's'}: {conflictAreaLabel(conflict)}</dd></div>
                        <div><dt className="text-muted">Overlap</dt>
                            <dd className="text-fg">{conflict.stillOverlapping
                                ? 'Still reported by the game server'
                                : 'No longer reported by the game server (resolve it to close it)'}</dd></div>
                        <div><dt className="text-muted">Detected</dt>
                            <dd className="text-fg">{formatDateTime(conflict.detectedAt)}; last reported {formatDateTime(conflict.lastReportedAt)}</dd></div>
                        {conflict.resolvedAt && (
                            <div><dt className="text-muted">Resolved</dt>
                                <dd className="text-fg">{formatDateTime(conflict.resolvedAt)}{conflict.resolutionNote ? `: ${conflict.resolutionNote}` : ''}</dd></div>
                        )}
                    </dl>

                    <div className="mt-4">
                        <h3 className="mb-2 text-sm font-semibold text-fg">Flagged structures</h3>
                        {conflict.flaggedStructures.length === 0 ? (
                            <p className="text-sm text-muted">No structure stands in this zone.</p>
                        ) : (
                            <ul className="divide-y divide-line rounded-md border border-line" aria-label="Flagged structures">
                                {conflict.flaggedStructures.map(s => (
                                    <li key={s.id} className="px-3 py-2 text-sm">
                                        <Link to={displayPath('Structure', s.id, returnTo)} className="font-medium text-primary hover:underline">
                                            {s.name ?? `Structure #${s.id}`}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-1 text-xs text-muted">They keep their owner; their loyalty is set on each structure's page.</p>
                    </div>

                    <div className="mt-4 space-y-3 border-t border-line pt-4">
                        {open ? (
                            <>
                                <div>
                                    <label htmlFor="territory-conflict-note" className="mb-1 block text-sm font-medium text-fg">Note (optional)</label>
                                    <textarea
                                        id="territory-conflict-note"
                                        rows={2}
                                        className="input px-3 py-2"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[conflict.holderA, conflict.holderB].map(holder => (
                                        <button
                                            key={`${holder.kind}-${holder.id}`}
                                            type="button"
                                            className="btn-primary text-sm"
                                            disabled={disabled}
                                            title={actionTitle}
                                            onClick={() => void resolve(
                                                { resolution: 'Awarded', awardedHolder: { kind: holder.kind, id: holder.id } },
                                                `Award to ${holder.name ?? `${holder.kind} #${holder.id}`}`
                                            )}
                                        >
                                            Award to {holder.name ?? `${holder.kind} #${holder.id}`}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className="btn-secondary text-sm"
                                        disabled={disabled}
                                        title={actionTitle}
                                        onClick={() => void resolve({ resolution: 'Redrawn' }, 'Mark the lines redrawn')}
                                    >
                                        Mark the lines redrawn
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button type="button" className="btn-secondary text-sm" disabled={disabled} title={actionTitle} onClick={() => void reopen()}>
                                Reopen
                            </button>
                        )}
                        {writeGate.hint && <p className="text-xs text-muted">{writeGate.hint}</p>}
                    </div>
                </>
            )}
            {confirmModal}
        </section>
    );
};

export default TerritoryConflictPanel;
