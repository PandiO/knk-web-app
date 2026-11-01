import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { siegeMatchClient } from '../../apiClients/siegeMatchClient';
import { formatStatisticsDate } from '../../types/dtos/statistics/StatisticsDtos';
import {
  formatSiegeNumber,
  SIEGE_OUTCOME_LABELS,
  SiegeMatchPublicSummaryDto,
  siegeOutcomeBadgeClass,
  siegeTeamColor,
} from '../../types/dtos/siege/SiegeMatchDtos';

// A player's siege matches (alpha run 1, PandiO/knk-workspace#174), newest first, each linking to the match page.
// Kills/deaths show as "Hidden" when the player keeps them private from this viewer.

export const PLAYER_SIEGE_MATCH_LIMIT = 20;

export const PlayerSiegeMatchList: React.FC<{ userId: number }> = ({ userId }) => {
  const [rows, setRows] = React.useState<SiegeMatchPublicSummaryDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    siegeMatchClient.getPlayerMatches(userId, PLAYER_SIEGE_MATCH_LIMIT)
      .then(result => { if (!cancelled) setRows(result); })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load the siege matches:', err);
        setError('Could not load the siege matches.');
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rows) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </div>
    );
  }
  if (rows.length === 0) return <p className="text-sm text-gray-500">No siege matches yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Siege matches">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Scenario</th>
            <th className="py-2 pr-4 font-medium">Team</th>
            <th className="py-2 pr-4 font-medium">Result</th>
            <th className="py-2 pr-4 font-medium text-right">Kills</th>
            <th className="py-2 pr-4 font-medium text-right">Deaths</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.id}>
              <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{formatStatisticsDate(row.endedAt ?? row.startedAt)}</td>
              <td className="py-2 pr-4 text-gray-900">{row.siegeScenarioName ?? '-'}</td>
              <td className="py-2 pr-4">
                {row.team
                  ? <span className="font-medium" style={{ color: siegeTeamColor(row.team.chatColor) }}>{row.team.name}</span>
                  : <span className="text-gray-400">-</span>}
              </td>
              <td className="py-2 pr-4">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${siegeOutcomeBadgeClass(row.participant.outcome)}`}>
                  {SIEGE_OUTCOME_LABELS[row.participant.outcome] ?? row.participant.outcome}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-gray-900">{formatSiegeNumber(row.participant.kills)}</td>
              <td className="py-2 pr-4 text-right text-gray-900">{formatSiegeNumber(row.participant.deaths)}</td>
              <td className="py-2 text-right">
                <Link to={`/siege/matches/${row.id}`} className="text-primary hover:underline whitespace-nowrap">Details</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerSiegeMatchList;
