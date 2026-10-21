import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, Loader2, RefreshCw, SlidersHorizontal, Swords } from 'lucide-react';
import { duelMatchClient } from '../../../apiClients/duelMatchClient';
import { arenaClient } from '../../../apiClients/arenaClient';
import { playerClient } from '../../../apiClients/playerClient';
import {
    DUEL_REVIEW_STATES,
    DUEL_STATUSES,
    DuelMatchDto,
    DuelMatchStatus,
    DuelReviewState,
} from '../../../types/dtos/duels/DuelDtos';
import { ArenaDto } from '../../../types/dtos/arena/ArenaDtos';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { formatWhen, outcomeText, PlayerLink, ReviewBadge, stakeSummary } from './duelFormat';

const LIMIT = 200;

const STATUS_LABELS: Record<DuelMatchStatus, string> = {
    Created: 'Locked in',
    InProgress: 'In progress',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    Aborted: 'Aborted',
};

/**
 * Staff → Duels (arena duels P7, KNG-221, DESIGN §10.3): every duel match, newest first, filtered by
 * arena, player, status and review state. A row opens the match (stakes, spoils, telemetry, signals,
 * and the Release / Void / Revert / Confiscate actions). Held results — paid out to nobody until staff
 * decide — are one filter away. Needs knk.admin.duel.review (StaffRoute node); the API checks it on
 * every action.
 */
export const DuelHistoryPage: React.FC = () => {
    usePageTitle('Duels');
    const [arenas, setArenas] = React.useState<ArenaDto[]>([]);
    const [arenaId, setArenaId] = React.useState('');
    const [player, setPlayer] = React.useState('');
    const [playerId, setPlayerId] = React.useState<number | undefined>(undefined);
    const [playerError, setPlayerError] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<DuelMatchStatus | ''>('');
    const [review, setReview] = React.useState<DuelReviewState | ''>('');

    const [matches, setMatches] = React.useState<DuelMatchDto[] | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        arenaClient.getAll().then(setArenas).catch(() => setArenas([]));
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setMatches(await duelMatchClient.query({
                arenaId: arenaId ? Number(arenaId) : undefined, userId: playerId, status, review, limit: LIMIT
            }));
        } catch (err) {
            setError(apiRefusalReason(err) ?? 'Could not load the duel history.');
        } finally {
            setLoading(false);
        }
    }, [arenaId, playerId, status, review]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const applyPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setPlayerError(null);
        const name = player.trim();
        if (!name) {
            setPlayerId(undefined);
            return;
        }
        if (/^\d+$/.test(name)) {
            setPlayerId(Number(name));
            return;
        }
        try {
            setPlayerId((await playerClient.getByName(name)).userId);
        } catch {
            setPlayerError(`No player called "${name}".`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <Link to="/admin/users" className="text-sm text-gray-500 hover:underline inline-flex items-center">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Player moderation
                        </Link>
                        <h1 className="mt-2 text-2xl font-bold text-gray-900 flex items-center">
                            <Swords className="h-6 w-6 mr-2" />
                            Duels
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Every arena duel with its stakes and result. Suspicious results are flagged (paid) or held
                            (not paid until you release or void them); open a match to review it. Duel alerts also show on
                            the currency alerts page.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Link to="/admin/duels/restrictions" className="btn-secondary text-sm whitespace-nowrap">
                            <Ban className="h-4 w-4 mr-2" />
                            Restrictions
                        </Link>
                        <Link to="/admin/duels/policy" className="btn-secondary text-sm whitespace-nowrap">
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            Review policy
                        </Link>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-end">
                        <div>
                            <label htmlFor="duel-arena" className="block text-xs text-gray-500 mb-1">Arena</label>
                            <select id="duel-arena" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={arenaId}
                                onChange={e => setArenaId(e.target.value)}>
                                <option value="">Any</option>
                                {arenas.map(a => <option key={a.id} value={a.id}>{a.name ?? `#${a.id}`}</option>)}
                            </select>
                        </div>
                        <form onSubmit={e => void applyPlayer(e)}>
                            <label htmlFor="duel-player" className="block text-xs text-gray-500 mb-1">Player (name or id)</label>
                            <input id="duel-player" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-40" value={player}
                                onChange={e => setPlayer(e.target.value)} onBlur={e => void applyPlayer(e)} />
                        </form>
                        <div>
                            <label htmlFor="duel-status" className="block text-xs text-gray-500 mb-1">Status</label>
                            <select id="duel-status" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={status}
                                onChange={e => setStatus(e.target.value as DuelMatchStatus | '')}>
                                <option value="">Any</option>
                                {DUEL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="duel-review" className="block text-xs text-gray-500 mb-1">Review</label>
                            <select id="duel-review" className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={review}
                                onChange={e => setReview(e.target.value as DuelReviewState | '')}>
                                <option value="">Any</option>
                                {DUEL_REVIEW_STATES.map(r => <option key={r} value={r}>{r === 'None' ? 'Not flagged' : r}</option>)}
                            </select>
                        </div>
                        <button type="button" className="btn-secondary text-sm" onClick={() => void load()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                    {playerError && <p className="px-4 pt-3 text-sm text-red-600">{playerError}</p>}
                    {error && <p className="p-4 text-sm text-red-600">{error}</p>}
                    {loading && !matches && (
                        <div className="p-4 flex items-center text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading…
                        </div>
                    )}
                    {matches && matches.length === 0 && !error && (
                        <p className="p-6 text-sm text-gray-500">No duels match these filters.</p>
                    )}
                    {matches && matches.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                                        <th className="px-4 py-2 font-medium">Match</th>
                                        <th className="px-4 py-2 font-medium">Duelists</th>
                                        <th className="px-4 py-2 font-medium">Arena</th>
                                        <th className="px-4 py-2 font-medium">Stakes</th>
                                        <th className="px-4 py-2 font-medium">Result</th>
                                        <th className="px-4 py-2 font-medium">Review</th>
                                        <th className="px-4 py-2 font-medium">Ended</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matches.map(m => (
                                        <tr key={m.id} className="border-b border-gray-100 align-top">
                                            <td className="px-4 py-2">
                                                <Link to={`/admin/duels/${m.id}`} className="text-primary hover:underline">#{m.id}</Link>
                                            </td>
                                            <td className="px-4 py-2">
                                                <PlayerLink userId={m.challengerUserId} username={m.challengerUsername} />
                                                <span className="text-gray-400"> vs </span>
                                                <PlayerLink userId={m.opponentUserId} username={m.opponentUsername} />
                                            </td>
                                            <td className="px-4 py-2 text-gray-700">{m.arenaName ?? m.arenaKey ?? `#${m.arenaId}`}</td>
                                            <td className="px-4 py-2 text-gray-700">{stakeSummary(m)}</td>
                                            <td className="px-4 py-2 text-gray-700">{outcomeText(m)}</td>
                                            <td className="px-4 py-2">
                                                <ReviewBadge review={m.review} tier={m.reviewTier} />
                                                {m.reviewSignals.length > 0 && (
                                                    <span className="ml-1 text-xs text-gray-500">{m.reviewSignals.join(' ')}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatWhen(m.endedAt ?? m.lockedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {matches.length >= LIMIT && (
                                <p className="p-4 text-xs text-gray-500">Showing the newest {LIMIT}; narrow the filters to see older duels.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DuelHistoryPage;
