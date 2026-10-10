import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trophy } from 'lucide-react';
import { leaderboardClient } from '../../apiClients/leaderboardClient';
import {
  LEADERBOARD_PERIODS,
  LeaderboardBoardDto,
  LeaderboardPeriod,
  leaderboardPeriodLabel,
  LeaderboardViewDto,
} from '../../types/dtos/leaderboards/LeaderboardDtos';
import { formatStatistic } from '../../types/dtos/statistics/StatisticsDtos';

// Leaderboards (/leaderboards, KNG-34, DESIGN.md §F.11): every board, weekly / monthly / all time,
// from snapshots refreshed every few minutes. Signed out, only the always-public boards (playtime,
// XP) can be read - the others rank players who show a statistic to "everyone", which means
// signed-in viewers (L1-3); the API answers 401 and the page asks to sign in.

export const LEADERBOARD_TOP = 25;

const metricOf = (boardKey: string) => boardKey.split('@')[0];

export const LeaderboardsPage: React.FC = () => {
  const [boards, setBoards] = React.useState<LeaderboardBoardDto[]>([]);
  const [boardKey, setBoardKey] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<LeaderboardPeriod>('weekly');
  const [view, setView] = React.useState<LeaderboardViewDto | null>(null);
  const [loadingBoards, setLoadingBoards] = React.useState(true);
  const [loadingView, setLoadingView] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [signInNeeded, setSignInNeeded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    leaderboardClient.getBoards()
      .then(result => {
        if (cancelled) return;
        setBoards(result ?? []);
        setBoardKey(current => current ?? result?.[0]?.boardKey ?? null);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load the leaderboards:', err);
        setError('Could not load the leaderboards.');
      })
      .finally(() => { if (!cancelled) setLoadingBoards(false); });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!boardKey) return;
    let cancelled = false;
    setLoadingView(true);
    setError(null);
    setSignInNeeded(false);
    leaderboardClient.getBoard(boardKey, period, LEADERBOARD_TOP)
      .then(result => { if (!cancelled) setView(result); })
      .catch(err => {
        if (cancelled) return;
        setView(null);
        if ((err as { status?: number })?.status === 401) {
          setSignInNeeded(true);
        } else {
          console.error('Failed to load the leaderboard:', err);
          setError('Could not load this leaderboard.');
        }
      })
      .finally(() => { if (!cancelled) setLoadingView(false); });
    return () => { cancelled = true; };
  }, [boardKey, period]);

  const board = boards.find(b => b.boardKey === boardKey);

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
        <Trophy className="h-6 w-6 mr-2 text-amber-500" />
        Leaderboards
      </h1>
      <p className="text-sm text-gray-600">
        Updated every few minutes. Playtime and XP rank everyone; other boards rank players who show that statistic to everyone.
        Equal values share a rank; whoever reached it first is listed first.
      </p>

      {loadingBoards ? (
        <div className="flex items-center text-sm text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <nav aria-label="Leaderboards" className="md:w-64 shrink-0">
            <ul className="space-y-1">
              {boards.map(b => (
                <li key={b.boardKey}>
                  <button
                    type="button"
                    aria-current={b.boardKey === boardKey ? 'true' : undefined}
                    onClick={() => setBoardKey(b.boardKey)}
                    className={`w-full text-left rounded-md px-3 py-1.5 text-sm ${b.boardKey === boardKey
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {b.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="flex-1 space-y-3" aria-label={board?.label ?? 'Leaderboard'}>
            <div role="tablist" aria-label="Period" className="flex flex-wrap gap-2">
              {LEADERBOARD_PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={p === period}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1 text-sm border ${p === period
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {leaderboardPeriodLabel(p)}
                </button>
              ))}
            </div>

            {loadingView ? (
              <div className="flex items-center text-sm text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</div>
            ) : signInNeeded ? (
              <p className="text-sm text-gray-600">
                <Link to="/auth/login" className="text-primary hover:underline">Sign in</Link> to see this leaderboard.
              </p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : view ? (
              <LeaderboardTable view={view} />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
};

const LeaderboardTable: React.FC<{ view: LeaderboardViewDto }> = ({ view }) => {
  const metric = metricOf(view.boardKey);
  if (!view.generatedAt) {
    return <p className="text-sm text-gray-500">Not computed yet - check back in a few minutes.</p>;
  }
  return (
    <div className="space-y-2">
      {view.entries.length === 0 ? (
        <p className="text-sm text-gray-500">Nobody is ranked yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-1 w-16">Rank</th>
              <th className="py-1">Player</th>
              <th className="py-1 text-right">{view.label}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {view.entries.map(entry => (
              <tr key={entry.userId}>
                <td className="py-1.5 font-medium text-gray-700">#{entry.rank}</td>
                <td className="py-1.5">
                  <Link to={`/players/${encodeURIComponent(entry.username)}`} className="text-primary hover:underline">{entry.username}</Link>
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatStatistic(metric, view.unit, entry.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {view.viewer ? (
        <p className="text-sm text-gray-700">
          Your rank: <span className="font-medium">#{view.viewer.rank}</span> of {view.totalRanked} &middot;{' '}
          {formatStatistic(metric, view.unit, view.viewer.value)}
        </p>
      ) : (
        <p className="text-xs text-gray-500">{view.totalRanked} ranked. Updated {new Date(view.generatedAt).toLocaleString()}.</p>
      )}
    </div>
  );
};

export default LeaderboardsPage;
