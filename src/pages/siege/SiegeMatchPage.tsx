import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Flag, Loader2, Swords } from 'lucide-react';
import { siegeMatchClient } from '../../apiClients/siegeMatchClient';
import { formatDuration } from '../../types/dtos/statistics/StatisticsDtos';
import {
  formatSiegeNumber,
  SIEGE_END_REASON_LABELS,
  SIEGE_OUTCOME_LABELS,
  SiegeMatchPublicDto,
  SiegeMatchPublicParticipantDto,
  SiegeMatchPublicTeamDto,
  siegeOutcomeBadgeClass,
  siegeTeamColor,
} from '../../types/dtos/siege/SiegeMatchDtos';

// The public page of one finished siege match (alpha run 1, PandiO/knk-workspace#174), /siege/matches/:id - the
// in-game result and /siege history link here. Open to everyone: the facts are public; each player's own numbers
// show as "Hidden" when they keep them private from this viewer.

const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

export const SiegeMatchPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [match, setMatch] = React.useState<SiegeMatchPublicDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const matchId = Number(id);
    setLoading(true);
    setError(null);
    setMatch(null);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      setError('This isn\'t a siege match.');
      setLoading(false);
      return;
    }
    siegeMatchClient.getMatch(matchId)
      .then(result => { if (!cancelled) setMatch(result); })
      .catch(err => {
        if (cancelled) return;
        if ((err as { status?: number })?.status === 404) {
          setError('No finished siege match with this number.');
        } else {
          console.error('Failed to load the siege match:', err);
          setError('Could not load this match.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </div>
    );
  }
  if (error || !match) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-2">
        <p className="text-red-600">{error ?? 'Could not load this match.'}</p>
        <Link to="/leaderboards" className="text-sm text-primary hover:underline">Back to the leaderboards</Link>
      </div>
    );
  }

  const teamsById = new Map(match.teams.map(t => [t.id, t]));
  const duration = match.startedAt && match.endedAt
    ? formatDuration((new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime()) / 1000)
    : '-';
  const winners = match.teams.filter(t => t.outcome === 'Win');
  const headline = match.status === 'Aborted' ? 'Aborted'
    : winners.length === 0 ? 'Draw'
    : `${winners.map(t => t.name).join(' & ')} won`;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3">
          <Swords className="h-10 w-10 text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{match.siegeScenarioName ?? 'Siege match'}</h1>
            <p className="text-sm text-gray-600">{match.siegeLobbyName ?? 'Siege'} · match #{match.id}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Fact label="Result" value={headline} />
          <Fact label="Ended because" value={match.endReason ? SIEGE_END_REASON_LABELS[match.endReason] ?? match.endReason : '-'} />
          <Fact label="Ended" value={formatDateTime(match.endedAt)} />
          <Fact label="Length" value={duration} />
        </dl>
      </div>

      {match.teams.map(team => (
        <TeamSection key={team.id} team={team} players={match.participants.filter(p => p.siegeTeamId === team.id)} />
      ))}
      {match.participants.some(p => p.siegeTeamId == null || !teamsById.has(p.siegeTeamId)) && (
        <TeamSection players={match.participants.filter(p => p.siegeTeamId == null || !teamsById.has(p.siegeTeamId))} />
      )}

      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Objectives</h2>
        {match.objectives.length === 0 ? (
          <p className="text-sm text-gray-500">No objective results recorded.</p>
        ) : (
          <ul className="divide-y divide-gray-100" aria-label="Objectives">
            {match.objectives.map((o, index) => {
              const holder = o.finalHolderTeamId != null ? teamsById.get(o.finalHolderTeamId) : undefined;
              return (
                <li key={`${o.siegeObjectiveId ?? 'x'}-${index}`} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-gray-900">
                      <Flag className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{o.name ?? `Objective ${o.siegeObjectiveId ?? ''}`}</span>
                      {o.instantVictory && <span className="text-xs text-gray-500">(main)</span>}
                    </span>
                    <span className="text-gray-700">
                      Held by{' '}
                      {holder
                        ? <span className="font-medium" style={{ color: siegeTeamColor(holder.chatColor) }}>{holder.name}</span>
                        : '-'}
                    </span>
                  </div>
                  {o.captures.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Captured {o.captures.map(c => `${c.capturedByUsername ? `by ${c.capturedByUsername}` : ''}${c.capturedAt ? ` at ${new Date(c.capturedAt).toLocaleTimeString()}` : ''}`.trim()).join('; ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-gray-500">Numbers a player keeps private show as "Hidden".</p>
    </div>
  );
};

const TeamSection: React.FC<{ team?: SiegeMatchPublicTeamDto; players: SiegeMatchPublicParticipantDto[] }> = ({ team, players }) => (
  <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-3">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold" style={{ color: team ? siegeTeamColor(team.chatColor) : undefined }}>
        {team ? team.name : 'Other players'}
        {team && <span className="ml-2 text-sm font-normal text-gray-500">{team.role === 'Defender' ? 'defenders' : 'attackers'}</span>}
      </h2>
      {team && (
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${siegeOutcomeBadgeClass(team.outcome)}`}>
          {SIEGE_OUTCOME_LABELS[team.outcome] ?? team.outcome}
        </span>
      )}
    </div>
    {players.length === 0 ? (
      <p className="text-sm text-gray-500">No players.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-label={team ? `${team.name} players` : 'Other players'}>
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4 font-medium">Player</th>
              <th className="py-2 pr-4 font-medium text-right">Kills</th>
              <th className="py-2 pr-4 font-medium text-right">Deaths</th>
              <th className="py-2 pr-4 font-medium text-right">Best streak</th>
              <th className="py-2 pr-4 font-medium text-right">Captures</th>
              <th className="py-2 pr-4 font-medium text-right">Gate damage</th>
              <th className="py-2 pr-4 font-medium text-right">Active</th>
              <th className="py-2 pr-4 font-medium text-right">Coins</th>
              <th className="py-2 font-medium text-right">XP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {players.map(p => (
              <tr key={p.userId}>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {p.username
                    ? <Link to={`/players/${encodeURIComponent(p.username)}`} className="text-primary hover:underline">{p.username}</Link>
                    : <span className="text-gray-500">Player {p.userId}</span>}
                  {!p.presentAtEnd && p.outcome === 'Left' && <span className="ml-2 text-xs text-gray-500">left early</span>}
                </td>
                <td className="py-2 pr-4 text-right">{formatSiegeNumber(p.kills)}</td>
                <td className="py-2 pr-4 text-right">{formatSiegeNumber(p.deaths)}</td>
                <td className="py-2 pr-4 text-right">{formatSiegeNumber(p.highestKillStreak)}</td>
                <td className="py-2 pr-4 text-right">{formatSiegeNumber(p.captures)}</td>
                <td className="py-2 pr-4 text-right">{formatSiegeNumber(p.gateDamage)}</td>
                <td className="py-2 pr-4 text-right whitespace-nowrap">{formatDuration(p.activeSeconds)} / {formatDuration(p.matchSeconds)}</td>
                <td className="py-2 pr-4 text-right">{formatSiegeNumber(p.coinsAwarded)}</td>
                <td className="py-2 text-right">{p.expAwarded.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900">{value}</dd>
  </div>
);

export default SiegeMatchPage;
