import React from 'react';
import { Loader2 } from 'lucide-react';
import { statisticsClient } from '../../apiClients/statisticsClient';
import {
  contextLabel,
  formatDuration,
  formatStatistic,
  formatStatisticsDate,
  PlayerStatisticMetricDto,
  PlayerStatisticsDto,
  STATISTICS_PERIODS,
  StatisticsCatalogDto,
  StatisticsPeriod,
  statisticsPeriodLabel,
} from '../../types/dtos/statistics/StatisticsDtos';
import { StatisticBars } from './StatisticBars';

// A player's statistics as the API shows them to the current viewer (KNG-34, DESIGN.md §F.1,
// §F.4): the always-public profile, then each catalogue group with its visible metrics (per-context
// bars) for the chosen period, plus economy and discovery counts when visible. Shared by the account
// page, the public profile and the staff panel - the API decides what each of them sees.

const ALWAYS_PUBLIC = new Set(['active_playtime', 'afk_time', 'xp_gained']);

export const StatisticsOverview: React.FC<{
  userId: number;
  /** Show the period tabs (lifetime, today, this week, this month). */
  showPeriodTabs?: boolean;
  /** Show the profile summary (title, XP, playtime, first join) above the groups. */
  showProfile?: boolean;
}> = ({ userId, showPeriodTabs = true, showProfile = true }) => {
  const [period, setPeriod] = React.useState<StatisticsPeriod>('lifetime');
  const [catalog, setCatalog] = React.useState<StatisticsCatalogDto | null>(null);
  const [statistics, setStatistics] = React.useState<PlayerStatisticsDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([statisticsClient.getCatalog(), statisticsClient.getUserStatistics(userId, period)])
      .then(([catalogResult, statisticsResult]) => {
        if (cancelled) return;
        setCatalog(catalogResult);
        setStatistics(statisticsResult);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load statistics:', err);
        setError((err as { status?: number })?.status === 404 ? 'This player was not found.' : 'Could not load the statistics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, period]);

  const metricsByGroup = React.useMemo(() => {
    const byGroup = new Map<string, { metric: PlayerStatisticMetricDto; label: string }[]>();
    if (!catalog || !statistics) return byGroup;
    for (const definition of catalog.metrics) {
      const metric = statistics.metrics.find(m => m.key === definition.key);
      if (!metric) continue;
      const list = byGroup.get(definition.group) ?? [];
      list.push({ metric, label: definition.label });
      byGroup.set(definition.group, list);
    }
    return byGroup;
  }, [catalog, statistics]);

  const hidesConfigurable = statistics !== null
    && statistics.viewer !== 'self' && statistics.viewer !== 'staff'
    && !statistics.economy && !statistics.discoveries
    && statistics.metrics.every(m => ALWAYS_PUBLIC.has(m.key));

  return (
    <div className="space-y-4">
      {showPeriodTabs && (
        <div role="tablist" aria-label="Period" className="flex flex-wrap gap-2">
          {STATISTICS_PERIODS.map(p => (
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
              {statisticsPeriodLabel(p)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : error || !statistics || !catalog ? (
        <p className="text-sm text-red-600">{error ?? 'Could not load the statistics.'}</p>
      ) : (
        <>
          {showProfile && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <ProfileFact label="Title" value={statistics.profile.titleName ?? '-'} />
              <ProfileFact label="Experience" value={statistics.profile.experience.toLocaleString('en-US')} />
              <ProfileFact label="Active playtime" value={formatDuration(statistics.profile.activePlaytimeSeconds)} />
              <ProfileFact label="First joined" value={formatStatisticsDate(statistics.profile.firstJoinedAt)} />
            </dl>
          )}

          {catalog.groups.map(group => {
            const metrics = metricsByGroup.get(group.key) ?? [];
            const economy = group.key === 'progression' ? statistics.economy : null;
            const discoveries = group.key === 'exploration' ? statistics.discoveries : null;
            if (metrics.length === 0 && !economy && !discoveries) return null;
            return (
              <section key={group.key} aria-label={group.label}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{group.label}</h3>
                <ul className="divide-y divide-gray-100">
                  {metrics.map(({ metric, label }) => (
                    <li key={metric.key} className="py-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">{label}</span>
                        <span className="font-medium text-gray-900 tabular-nums">
                          {metric.value !== null ? formatStatistic(metric.key, metric.unit, metric.value) : 'Total hidden'}
                        </span>
                      </div>
                      {metric.contexts && metric.contexts.length > 0 && (
                        <div className="mt-1">
                          <StatisticBars
                            ariaLabel={`${label} per game`}
                            bars={metric.contexts.map(c => ({
                              key: c.context,
                              label: contextLabel(c.context),
                              value: c.rawValue,
                              display: formatStatistic(metric.key, metric.unit, c.value),
                            }))}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                  {discoveries && (
                    <li className="py-2 flex justify-between text-sm">
                      <span className="text-gray-700">Discoveries</span>
                      <span className="font-medium text-gray-900">
                        {discoveries.total}{' '}
                        <span className="text-xs text-gray-500">
                          (towns {discoveries.towns}, districts {discoveries.districts}, structures {discoveries.structures})
                        </span>
                      </span>
                    </li>
                  )}
                  {economy && (
                    <li className="py-2 space-y-1">
                      <span className="text-sm text-gray-700">Coins and gems</span>
                      <StatisticBars
                        ariaLabel="Coins and gems earned and spent"
                        bars={[
                          { key: 'coinsEarned', label: 'Coins earned', value: economy.coinsEarned, display: economy.coinsEarned.toLocaleString('en-US') },
                          { key: 'coinsSpent', label: 'Coins spent', value: economy.coinsSpent, display: economy.coinsSpent.toLocaleString('en-US') },
                          { key: 'gemsEarned', label: 'Gems earned', value: economy.gemsEarned, display: economy.gemsEarned.toLocaleString('en-US') },
                          { key: 'gemsSpent', label: 'Gems spent', value: economy.gemsSpent, display: economy.gemsSpent.toLocaleString('en-US') },
                        ]}
                      />
                    </li>
                  )}
                </ul>
              </section>
            );
          })}

          {hidesConfigurable && (
            <p className="text-sm text-gray-500">
              {statistics.viewer === 'anonymous'
                ? 'Sign in to see the statistics this player shares with everyone.'
                : `${statistics.username} keeps their other statistics private.`}
            </p>
          )}
        </>
      )}
    </div>
  );
};

const ProfileFact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900">{value}</dd>
  </div>
);
