import React from 'react';
import { Link } from 'react-router-dom';
import { Ban, Loader2 } from 'lucide-react';
import { duelMatchClient } from '../../apiClients/duelMatchClient';
import { playerClient } from '../../apiClients/playerClient';
import { usePermission } from '../../hooks/useStaffAccess';
import { DUEL_REVIEW_NODE, DuelRestrictionDto } from '../../types/dtos/duels/DuelDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { parseUtc } from '../currency/BalanceLedgerTable';

// Arena duels P7 (KNG-221, DESIGN §10.3 "duel restrictions", §13.3 P1): bar a player, or one pair, from
// value-moving duels (coin or item stakes, drop mode) until an optional end date. Friendly duels stay
// allowed. Used on Staff → Duels → Restrictions and on the player's staff profile. Needs
// knk.admin.duel.review; the API checks it too (a 403 hides the panel).

const formatWhen = (value?: string | null): string => {
    if (!value) return '—';
    const date = parseUtc(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

/** A name or a numeric id → the user id (names through the public profile lookup). */
export async function resolvePlayer(value: string): Promise<number> {
    const text = value.trim();
    if (/^\d+$/.test(text)) return Number(text);
    try {
        return (await playerClient.getByName(text)).userId;
    } catch {
        throw new Error(`No player called "${text}".`);
    }
}

/** `<input type="datetime-local">` (the viewer's time zone) → ISO UTC, or null when empty. */
export function expiryToIso(value: string): string | null {
    if (!value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const DuelRestrictionsPanel: React.FC<{
    /** One player's restrictions (either side of a pair); all players when absent. */
    userId?: number;
    username?: string;
    /** Rendered as a profile card (hidden without the node) instead of a page section. */
    asProfileCard?: boolean;
}> = ({ userId, username, asProfileCard }) => {
    const { allowed } = usePermission(DUEL_REVIEW_NODE);
    const [activeOnly, setActiveOnly] = React.useState(true);
    const [items, setItems] = React.useState<DuelRestrictionDto[] | null>(null);
    const [forbidden, setForbidden] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setError(null);
        try {
            setItems(await duelMatchClient.getRestrictions(userId, activeOnly));
        } catch (err) {
            if ((err as { status?: number })?.status === 403) setForbidden(true);
            else setError(apiRefusalReason(err) ?? 'Could not load the duel restrictions.');
        }
    }, [userId, activeOnly]);

    React.useEffect(() => {
        if (asProfileCard && !allowed) return;
        void load();
    }, [load, asProfileCard, allowed]);

    if (asProfileCard && (!allowed || forbidden)) return null;

    return (
        <section className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4" aria-label="Duel restrictions">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Ban className="h-5 w-5 mr-2" />
                    Duel restrictions
                </h2>
                <label className="text-sm text-gray-600 flex items-center gap-2">
                    <input type="checkbox" checked={!activeOnly} onChange={e => setActiveOnly(!e.target.checked)} />
                    Show lifted and expired
                </label>
            </div>
            <p className="text-sm text-gray-500">
                A restriction refuses staked and drop-mode duels (at invite, accept and lock-in); friendly duels stay allowed.
                The player sees the reason and the end date. For abuse across the economy use the currency transfer lock.
            </p>
            {forbidden && <p className="text-sm text-red-600">You don&apos;t have permission to manage duel restrictions.</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!items && !error && !forbidden && (
                <div className="flex items-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                </div>
            )}
            {items && items.length === 0 && (
                <p className="text-sm text-gray-500">{activeOnly ? 'No active duel restrictions.' : 'No duel restrictions.'}</p>
            )}
            {items && items.length > 0 && (
                <ul className="divide-y divide-gray-100">
                    {items.map(r => <RestrictionRow key={r.id} restriction={r} onLifted={() => void load()} />)}
                </ul>
            )}
            {!forbidden && <CreateForm userId={userId} username={username} onCreated={() => void load()} />}
        </section>
    );
};

const PlayerName: React.FC<{ id: number; name?: string | null }> = ({ id, name }) => (
    <Link to={`/admin/users/${id}`} className="text-primary hover:underline">{name ?? `#${id}`}</Link>
);

const RestrictionRow: React.FC<{ restriction: DuelRestrictionDto; onLifted: () => void }> = ({ restriction: r, onLifted }) => {
    const [lifting, setLifting] = React.useState(false);
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const lift = async () => {
        setBusy(true);
        setError(null);
        try {
            await duelMatchClient.liftRestriction(r.id, reason.trim());
            setLifting(false);
            onLifted();
        } catch (err) {
            setError(apiRefusalReason(err) ?? 'Could not lift the restriction.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="py-3 text-sm" aria-label={`Restriction ${r.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.active ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                            {r.active ? 'Active' : r.liftedAt ? 'Lifted' : 'Expired'}
                        </span>
                        <PlayerName id={r.userId} name={r.username} />
                        {r.otherUserId != null && <>
                            <span className="text-gray-400">with</span>
                            <PlayerName id={r.otherUserId} name={r.otherUsername} />
                            <span className="text-xs text-gray-500">(this pair only)</span>
                        </>}
                    </div>
                    <p className="mt-1 text-gray-800 break-words">{r.reason}</p>
                    <p className="mt-1 text-xs text-gray-500">
                        Since {formatWhen(r.createdAt)} · {r.expiresAt ? `until ${formatWhen(r.expiresAt)}` : 'no end date'}
                        {r.liftedAt && ` · lifted ${formatWhen(r.liftedAt)}${r.liftReason ? `: ${r.liftReason}` : ''}`}
                    </p>
                </div>
                {r.active && !lifting && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => setLifting(true)} aria-label={`Lift restriction ${r.id}`}>
                        Lift
                    </button>
                )}
            </div>
            {lifting && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem]">
                        <label htmlFor={`lift-reason-${r.id}`} className="block text-xs text-gray-500 mb-1">Why (optional)</label>
                        <input id={`lift-reason-${r.id}`} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full"
                            maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void lift()}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm lift'}
                    </button>
                    <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setLifting(false)}>Cancel</button>
                </div>
            )}
            {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
        </li>
    );
};

const CreateForm: React.FC<{ userId?: number; username?: string; onCreated: () => void }> = ({ userId, username, onCreated }) => {
    const [player, setPlayer] = React.useState('');
    const [other, setOther] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [expires, setExpires] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

    const fixedPlayer = userId != null;
    const canSubmit = (fixedPlayer || player.trim() !== '') && reason.trim() !== '';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setMessage(null);
        try {
            const target = fixedPlayer ? userId! : await resolvePlayer(player);
            const otherId = other.trim() ? await resolvePlayer(other) : null;
            const expiresAt = expiryToIso(expires);
            if (expires.trim() && !expiresAt) throw new Error('The end date is not a valid date.');
            await duelMatchClient.createRestriction({ userId: target, otherUserId: otherId, reason: reason.trim(), expiresAt });
            setMessage({ ok: true, text: 'Restriction added.' });
            setPlayer('');
            setOther('');
            setReason('');
            setExpires('');
            onCreated();
        } catch (err) {
            // Our own errors (an unknown name, a bad date) have no HTTP status; show those as they are.
            const own = (err as { status?: number })?.status === undefined ? (err as Error)?.message : undefined;
            setMessage({ ok: false, text: apiRefusalReason(err) ?? own ?? 'Could not add the restriction.' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="border-t border-gray-200 pt-4 space-y-3" onSubmit={e => void submit(e)} aria-label="Add a duel restriction">
            <h3 className="text-sm font-semibold text-gray-900">Add a restriction</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fixedPlayer ? (
                    <p className="text-sm text-gray-700 self-end">Player: {username ?? `#${userId}`}</p>
                ) : (
                    <div>
                        <label htmlFor="restriction-player" className="block text-xs text-gray-500 mb-1">Player (name or id)</label>
                        <input id="restriction-player" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full"
                            value={player} onChange={e => setPlayer(e.target.value)} />
                    </div>
                )}
                <div>
                    <label htmlFor="restriction-other" className="block text-xs text-gray-500 mb-1">
                        Only against this player (name or id; empty = against everyone)
                    </label>
                    <input id="restriction-other" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full"
                        value={other} onChange={e => setOther(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="restriction-expires" className="block text-xs text-gray-500 mb-1">Ends (empty = until lifted)</label>
                    <input id="restriction-expires" type="datetime-local" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full"
                        value={expires} onChange={e => setExpires(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                    <label htmlFor="restriction-reason" className="block text-xs text-gray-500 mb-1">Reason (required; the player sees it)</label>
                    <input id="restriction-reason" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" maxLength={500}
                        value={reason} onChange={e => setReason(e.target.value)} />
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button type="submit" className="btn-primary text-sm" disabled={!canSubmit || busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add restriction'}
                </button>
                {message && <span role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</span>}
            </div>
        </form>
    );
};

export default DuelRestrictionsPanel;
