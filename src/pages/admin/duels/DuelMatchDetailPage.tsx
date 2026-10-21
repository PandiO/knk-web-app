import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Loader2, ShieldAlert, Swords } from 'lucide-react';
import { duelMatchClient } from '../../../apiClients/duelMatchClient';
import {
    DUEL_SIGNALS,
    DuelItemDto,
    DuelMatchDto,
    DuelRevertResultDto,
    DuelSideTelemetryDto,
    GEAR_MODE_LABELS,
} from '../../../types/dtos/duels/DuelDtos';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { formatCoins, formatWhen, numberFormat, outcomeText, PlayerLink, ReviewBadge } from './duelFormat';

type Action = 'release' | 'void' | 'revert' | 'confiscate';

const ACTION_TEXT: Record<Action, { label: string; help: string; reasonRequired: boolean; danger: boolean }> = {
    release: {
        label: 'Release',
        help: 'Pays the held result out as it stands: the winner gets the pot minus the fee, and the stake items and spoils.',
        reasonRequired: false,
        danger: false,
    },
    void: {
        label: 'Void',
        help: 'Cancels the held result: each side gets its own stake back, no fee is taken, and the duel stops counting in statistics.',
        reasonRequired: true,
        danger: true,
    },
    revert: {
        label: 'Revert',
        help: 'Undoes the paid result. Coins the winner still has are taken back and returned to the loser first, then to the winner up to their own stake; the fee is reversed. Undelivered items go back to their owners.',
        reasonRequired: true,
        danger: true,
    },
    confiscate: {
        label: 'Confiscate',
        help: 'For two accounts in on it: the coins taken back from the winner go to the coin sink instead of the players, the fee is kept, and undelivered items are destroyed.',
        reasonRequired: true,
        danger: true,
    },
};

const ACTION_DONE: Record<Action, string> = { release: 'Released', void: 'Voided', revert: 'Reverted', confiscate: 'Confiscated' };

/** A paid decisive result staff can still revert or confiscate. */
export const isPaidResult = (m: DuelMatchDto): boolean =>
    m.status === 'Completed' && m.winnerUserId != null && (m.review === 'None' || m.review === 'Flagged' || m.review === 'Released');

const nameOf = (m: DuelMatchDto, userId?: number | null): string =>
    userId == null ? '—'
        : userId === m.challengerUserId ? (m.challengerUsername ?? `#${userId}`)
            : userId === m.opponentUserId ? (m.opponentUsername ?? `#${userId}`) : `#${userId}`;

/**
 * Staff → Duels → one match (arena duels P7, KNG-221, DESIGN §10.3): stakes, spoils, fight telemetry and
 * the review (signals, tier, escalation), with Release / Void on a held result, Revert / Confiscate on a
 * paid one (a reason is required and recorded in the audit log), the recovered and missing coins after a
 * revert, and "clear escalation" for the pair or the winner. Needs knk.admin.duel.review.
 */
export const DuelMatchDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const matchId = Number(id);
    usePageTitle(`Duel #${id}`);

    const [match, setMatch] = React.useState<DuelMatchDto | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [lastRevert, setLastRevert] = React.useState<DuelRevertResultDto | null>(null);

    const load = React.useCallback(async () => {
        setError(null);
        try {
            setMatch(await duelMatchClient.getById(matchId));
        } catch (err) {
            setError(apiRefusalReason(err) ?? 'Could not load the duel.');
        }
    }, [matchId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <Link to="/admin/duels" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Duels
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                        <Swords className="h-6 w-6 mr-2" />
                        Duel #{id}
                    </h1>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {!match && !error && (
                    <div className="flex items-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading…
                    </div>
                )}
                {match && (
                    <>
                        <Summary match={match} />
                        <Stakes match={match} />
                        <Telemetry match={match} />
                        <Review match={match} revert={lastRevert ?? match.revertResult ?? null} />
                        <Actions match={match} onDone={(result, revert) => { setMatch(result); if (revert) setLastRevert(revert); }} />
                        <ClearEscalation match={match} />
                    </>
                )}
            </div>
        </div>
    );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-3" aria-label={title}>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {children}
    </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="text-sm text-gray-900">{children}</dd>
    </div>
);

const Summary: React.FC<{ match: DuelMatchDto }> = ({ match: m }) => (
    <Card title="Match">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Challenger"><PlayerLink userId={m.challengerUserId} username={m.challengerUsername} /></Field>
            <Field label="Opponent"><PlayerLink userId={m.opponentUserId} username={m.opponentUsername} /></Field>
            <Field label="Result">{outcomeText(m)}</Field>
            <Field label="Arena">{m.arenaName ?? m.arenaKey ?? `#${m.arenaId}`}{m.battlegroundKey ? ` · ${m.battlegroundKey}` : ''}</Field>
            <Field label="Gear">{GEAR_MODE_LABELS[m.gearMode] ?? m.gearMode}</Field>
            <Field label="Status">{m.status}{m.endReason ? ` (${m.endReason})` : ''}</Field>
            <Field label="Locked in">{formatWhen(m.lockedAt)}</Field>
            <Field label="Fight started">{formatWhen(m.fightStartedAt)}</Field>
            <Field label="Ended">{formatWhen(m.endedAt)}</Field>
            <Field label="Offers">{m.offerCount}</Field>
            <Field label="Token"><span className="font-mono text-xs">{m.publicToken}</span></Field>
        </dl>
    </Card>
);

const ItemTable: React.FC<{ match: DuelMatchDto; items: DuelItemDto[]; label: string }> = ({ match, items, label }) => (
    <table className="min-w-full text-sm" aria-label={label}>
        <thead>
            <tr className="text-left text-xs text-gray-500">
                <th className="py-1 pr-3 font-medium">Owner</th>
                <th className="py-1 pr-3 font-medium">Item</th>
                <th className="py-1 pr-3 font-medium text-right">Amount</th>
                <th className="py-1 pr-3 font-medium">Grade</th>
                <th className="py-1 pr-3 font-medium">Instance</th>
            </tr>
        </thead>
        <tbody>
            {items.map((item, i) => (
                <tr key={`${item.ownerUserId}-${item.material}-${i}`} className="border-t border-gray-100">
                    <td className="py-1 pr-3">{nameOf(match, item.ownerUserId)}</td>
                    <td className="py-1 pr-3">{item.name ? `${item.name} (${item.material})` : item.material}</td>
                    <td className="py-1 pr-3 text-right">{item.amount}</td>
                    <td className="py-1 pr-3">{item.grade ?? '—'}</td>
                    <td className="py-1 pr-3">{item.instanceId ?? '—'}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

const Stakes: React.FC<{ match: DuelMatchDto }> = ({ match: m }) => (
    <Card title="Stakes and spoils">
        {!m.valueMoving && <p className="text-sm text-gray-500">A friendly duel: nothing was staked.</p>}
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={`${nameOf(m, m.challengerUserId)} staked`}>{formatCoins(m.challengerCoins)}</Field>
            <Field label={`${nameOf(m, m.opponentUserId)} staked`}>{formatCoins(m.opponentCoins)}</Field>
            <Field label={`Fee (${m.feePercent}%)`}>{formatCoins(m.feeCoins)}</Field>
        </dl>
        {m.stakeItems.length > 0 && (
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Staked items</h3>
                <ItemTable match={m} items={m.stakeItems} label="Staked items" />
            </div>
        )}
        {m.spoilsItems.length > 0 && (
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Spoils (the loser&apos;s inventory, drop mode)</h3>
                <ItemTable match={m} items={m.spoilsItems} label="Spoils" />
            </div>
        )}
        <p className="text-xs text-gray-500">
            Ledger transactions: stake {m.stakeTransactionId ?? '—'}, payout {m.settlementTransactionId ?? '—'}, fee {m.feeTransactionId ?? '—'},
            refund {m.refundTransactionId ?? '—'}. Items are an audit record; the game server keeps them in escrow until they are delivered.
        </p>
    </Card>
);

const SideRow: React.FC<{ name: string; side?: DuelSideTelemetryDto | null; gear: boolean }> = ({ name, side, gear }) => (
    <tr className="border-t border-gray-100">
        <td className="py-1 pr-3">{name}</td>
        <td className="py-1 pr-3 text-right">{side ? numberFormat.format(side.damageDealt) : '—'}</td>
        <td className="py-1 pr-3 text-right">{side ? numberFormat.format(side.damageTaken) : '—'}</td>
        <td className="py-1 pr-3 text-right">{side?.hits ?? '—'}</td>
        <td className="py-1 pr-3 text-right">{side?.attackAttempts ?? '—'}</td>
        {gear && <td className="py-1 pr-3 text-right">{side?.armorPoints ?? '—'}</td>}
        {gear && <td className="py-1 pr-3">{side?.mainHand ?? (side?.hadWeapon === false ? 'no weapon' : '—')}</td>}
    </tr>
);

const Telemetry: React.FC<{ match: DuelMatchDto }> = ({ match: m }) => {
    const t = m.telemetry;
    const ownGear = m.gearMode === 'OWN_GEAR_KEEP' || m.gearMode === 'OWN_GEAR_DROP';
    return (
        <Card title="Fight">
            {!t ? <p className="text-sm text-gray-500">No fight telemetry (the duel didn&apos;t reach the fight, or the server sent none).</p> : (
                <>
                    <p className="text-sm text-gray-700">Duration: {numberFormat.format(t.durationSeconds)} s</p>
                    <table className="min-w-full text-sm" aria-label="Fight telemetry">
                        <thead>
                            <tr className="text-left text-xs text-gray-500">
                                <th className="py-1 pr-3 font-medium">Duelist</th>
                                <th className="py-1 pr-3 font-medium text-right">Damage dealt</th>
                                <th className="py-1 pr-3 font-medium text-right">Damage taken</th>
                                <th className="py-1 pr-3 font-medium text-right">Hits</th>
                                <th className="py-1 pr-3 font-medium text-right">Attack attempts</th>
                                {ownGear && <th className="py-1 pr-3 font-medium text-right">Armour at start</th>}
                                {ownGear && <th className="py-1 pr-3 font-medium">Main hand at start</th>}
                            </tr>
                        </thead>
                        <tbody>
                            <SideRow name={nameOf(m, m.challengerUserId)} side={t.challenger} gear={ownGear} />
                            <SideRow name={nameOf(m, m.opponentUserId)} side={t.opponent} gear={ownGear} />
                        </tbody>
                    </table>
                </>
            )}
        </Card>
    );
};

/** What a revert or confiscation recovered and what is still missing. */
export const RevertSummary: React.FC<{ revert: DuelRevertResultDto }> = ({ revert: r }) => (
    <div className={`rounded-md border p-3 text-sm space-y-1 ${r.missingCoins > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}
        role="status" aria-label={r.confiscated ? 'Confiscation result' : 'Revert result'}>
        <p className="font-medium text-gray-900">{r.confiscated ? 'Confiscated' : 'Reverted'}</p>
        <p>Recovered {formatCoins(r.recoveredCoins)} of the {formatCoins(r.payoutCoins)} payout.</p>
        {r.confiscated
            ? <p>{formatCoins(r.confiscatedCoins)} went to the coin sink; the fee was kept.</p>
            : <p>Fee reversed: {formatCoins(r.feeReversedCoins)}. Returned to the loser {formatCoins(r.returnedToLoserCoins)}, to the winner {formatCoins(r.returnedToWinnerCoins)}.</p>}
        {r.missingCoins > 0 ? (
            <p className="text-amber-800 flex items-start">
                <AlertTriangle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                Still missing: {formatCoins(r.missingCoins)} — the winner had already spent it. Use the currency tools
                (transfer lock, freeze, adjustment) if it needs recovering.
            </p>
        ) : <p className="text-green-800">Nothing is missing.</p>}
        <p className="text-gray-700">
            {r.undeliveredItems === 'Destroy'
                ? 'Items the game server hadn\'t delivered yet are destroyed.'
                : 'Items the game server hadn\'t delivered yet go back to their owners.'}
            {' '}Items already delivered can&apos;t be pulled back automatically: take them with /inventory or /enderchest in game.
        </p>
    </div>
);

const Review: React.FC<{ match: DuelMatchDto; revert: DuelRevertResultDto | null }> = ({ match: m, revert }) => {
    const details = m.reviewDetails ?? null;
    const values = details?.values ? Object.entries(details.values) : [];
    return (
        <Card title="Review">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <ReviewBadge review={m.review} tier={m.reviewTier} />
                {m.reviewTier != null && <span className="text-gray-600">Tier {m.reviewTier}</span>}
                {m.alertId != null && (
                    <Link to="/admin/economy/alerts" className="text-primary hover:underline inline-flex items-center">
                        <ShieldAlert className="h-4 w-4 mr-1" />
                        Alert #{m.alertId}
                    </Link>
                )}
            </div>
            {m.reviewTier == null && (
                <p className="text-sm text-gray-500">
                    Not scored: only decisive results with coin or item stakes, or drop-mode spoils, are reviewed.
                </p>
            )}
            {m.review === 'Held' && (
                <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-md p-2">
                    Held: nothing has been paid. While the hold is open, new staked duels between these players (and of the
                    winner) are refused. Release or void it below.
                </p>
            )}
            {m.reviewSignals.length > 0 && (
                <ul className="text-sm list-disc pl-5" aria-label="Signals">
                    {m.reviewSignals.map(s => <li key={s}><span className="font-medium">{s}</span> {DUEL_SIGNALS[s] ?? ''}</li>)}
                </ul>
            )}
            {(details?.escalatedByPair || details?.escalatedByBeneficiary) && (
                <p className="text-sm text-gray-700">
                    Escalated by {[details.escalatedByPair && 'the pair\'s earlier flags', details.escalatedByBeneficiary && 'the winner\'s earlier flags']
                        .filter(Boolean).join(' and ')}.
                </p>
            )}
            {values.length > 0 && (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs" aria-label="Review numbers">
                    {values.map(([key, value]) => (
                        <div key={key}><dt className="text-gray-500">{key}</dt><dd className="text-gray-900">{String(value)}</dd></div>
                    ))}
                </dl>
            )}
            {m.reviewedAt && (
                <p className="text-sm text-gray-700">
                    Reviewed {formatWhen(m.reviewedAt)}{m.reviewedByUserId != null && <> by <PlayerLink userId={m.reviewedByUserId} /></>}
                    {m.reviewReason && <>: &ldquo;{m.reviewReason}&rdquo;</>}
                </p>
            )}
            {revert && <RevertSummary revert={revert} />}
        </Card>
    );
};

const Actions: React.FC<{ match: DuelMatchDto; onDone: (match: DuelMatchDto, revert?: DuelRevertResultDto | null) => void }> = ({ match, onDone }) => {
    const [action, setAction] = React.useState<Action | null>(null);
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

    const available: Action[] = match.review === 'Held' ? ['release', 'void'] : isPaidResult(match) ? ['revert', 'confiscate'] : [];
    if (available.length === 0 && !message) return null;

    const spec = action ? ACTION_TEXT[action] : null;
    const reasonMissing = !!spec?.reasonRequired && reason.trim() === '';

    const run = async () => {
        if (!action || reasonMissing) return;
        setBusy(true);
        setMessage(null);
        try {
            const text = reason.trim();
            const result = action === 'release' ? await duelMatchClient.release(match.id, text)
                : action === 'void' ? await duelMatchClient.voidHeld(match.id, text)
                    : action === 'revert' ? await duelMatchClient.revert(match.id, text)
                        : await duelMatchClient.confiscate(match.id, text);
            onDone(result.match, result.revert);
            setMessage({ ok: true, text: `${ACTION_DONE[action]}${result.alreadyDone ? ' (it already was)' : ''}.` });
            setAction(null);
            setReason('');
        } catch (err) {
            setMessage({ ok: false, text: apiRefusalReason(err) ?? `Could not ${ACTION_TEXT[action].label.toLowerCase()} the duel.` });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title={match.review === 'Held' ? 'Decide the held result' : 'Paid result'}>
            <div className="flex flex-wrap gap-2">
                {available.map(a => (
                    <button key={a} type="button" className={`${ACTION_TEXT[a].danger ? 'btn-secondary' : 'btn-primary'} text-sm ${action === a ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => { setAction(a); setMessage(null); }}>
                        {ACTION_TEXT[a].label}…
                    </button>
                ))}
            </div>
            {spec && action && (
                <div className="space-y-2">
                    <p className="text-sm text-gray-700">{spec.help}</p>
                    <label htmlFor="duel-action-reason" className="block text-xs text-gray-500">
                        Reason {spec.reasonRequired ? '(required, recorded in the audit log)' : '(optional)'}
                    </label>
                    <textarea id="duel-action-reason" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" rows={2}
                        maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
                    <div className="flex gap-2">
                        <button type="button" className="btn-primary text-sm" disabled={busy || reasonMissing} onClick={() => void run()}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${spec.label.toLowerCase()}`}
                        </button>
                        <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => { setAction(null); setReason(''); }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {message && (
                <p role={message.ok ? 'status' : 'alert'} className={`text-sm inline-flex items-center ${message.ok ? 'text-green-700' : 'text-red-600'}`}>
                    {message.ok && <Check className="h-4 w-4 mr-1" />}
                    {message.text}
                </p>
            )}
        </Card>
    );
};

const ClearEscalation: React.FC<{ match: DuelMatchDto }> = ({ match: m }) => {
    const [scope, setScope] = React.useState<'pair' | 'winner'>('pair');
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
    if (!m.valueMoving) return null;

    const run = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const body = scope === 'pair'
                ? { userId: m.challengerUserId, otherUserId: m.opponentUserId, reason: reason.trim() || null }
                : { userId: m.winnerUserId!, reason: reason.trim() || null };
            const result = await duelMatchClient.clearEscalation(body);
            const count = result.acknowledgedAlertIds.length;
            setMessage({ ok: true, text: count === 0 ? 'There were no open flags to clear.' : `Cleared ${count} open flag${count === 1 ? '' : 's'}.` });
            setReason('');
        } catch (err) {
            setMessage({ ok: false, text: apiRefusalReason(err) ?? 'Could not clear the escalation.' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title="Clear escalation">
            <p className="text-sm text-gray-600">
                Two flags for the same players within the review window hold the next result. Clearing acknowledges their open
                flags as false positives, so they stop counting. Voided and reverted results keep counting.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                    <input type="radio" name="escalation-scope" checked={scope === 'pair'} onChange={() => setScope('pair')} />
                    The pair ({nameOf(m, m.challengerUserId)} and {nameOf(m, m.opponentUserId)})
                </label>
                {m.winnerUserId != null && (
                    <label className="flex items-center gap-2">
                        <input type="radio" name="escalation-scope" checked={scope === 'winner'} onChange={() => setScope('winner')} />
                        The winner ({nameOf(m, m.winnerUserId)}) against anyone
                    </label>
                )}
            </div>
            <label htmlFor="escalation-reason" className="block text-xs text-gray-500">Reason (optional)</label>
            <input id="escalation-reason" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" maxLength={500}
                value={reason} onChange={e => setReason(e.target.value)} />
            <div className="flex items-center gap-3">
                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void run()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clear escalation'}
                </button>
                {message && <span role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</span>}
            </div>
        </Card>
    );
};

export default DuelMatchDetailPage;
