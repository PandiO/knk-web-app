import React from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { discoveryClient } from '../../apiClients/discoveryClient';
import {
  DiscoveryProgressRowDto,
  DiscoverySummaryDto,
  discoveryTypeLabel,
} from '../../types/dtos/discovery/DiscoveryDtos';
import { DiscoverySummaryBars, formatDiscoveryDate, formatDiscoveryRewards } from './DiscoverySummaryBars';

// docs/specs/domain-discovery/DESIGN.md §3.9 - the player's own discoveries on the account page:
// per-type progress (summary) and the 10 most recent discoveries (progress, discovered only,
// newest first). The API lets a logged-in player read their own without any staff node.

export const RECENT_DISCOVERIES = 10;

export const MyDiscoveriesSection: React.FC<{ userId: number }> = ({ userId }) => {
  const [summary, setSummary] = React.useState<DiscoverySummaryDto | null>(null);
  const [recent, setRecent] = React.useState<DiscoveryProgressRowDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      discoveryClient.getSummary(userId),
      discoveryClient.getProgress(userId, {
        pageNumber: 1,
        pageSize: RECENT_DISCOVERIES,
        filters: { status: 'discovered' },
        sortBy: 'discoveredAt',
        sortDescending: true,
      }),
    ])
      .then(([summaryResult, recentResult]) => {
        if (cancelled) return;
        setSummary(summaryResult);
        setRecent(recentResult?.items ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load discoveries:', err);
        setError('Could not load your discoveries.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="border-b pb-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
        <Compass className="h-5 w-5 mr-2" />
        Discoveries
      </h2>
      {loading ? (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : error || !summary ? (
        <p className="text-sm text-red-600">{error ?? 'Could not load your discoveries.'}</p>
      ) : (
        <div className="space-y-4">
          <DiscoverySummaryBars summary={summary} />
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">
              You haven&apos;t discovered any places yet - explore towns, districts and structures in-game to earn rewards.
            </p>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Recently discovered</h3>
              <ul className="divide-y divide-gray-100">
                {recent.map((row) => (
                  <li key={row.domainId} className="py-2 flex items-start justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-500">
                        {discoveryTypeLabel(row.domainType)}
                        {row.parentName && <> in {row.parentName}</>}
                        {' '}&middot; {formatDiscoveryRewards(row)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDiscoveryDate(row.discoveredAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
