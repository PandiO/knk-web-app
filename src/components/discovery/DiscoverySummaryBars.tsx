import React from 'react';
import { formatAmount } from '../../utils/auditDetails';
import {
  DiscoverySummaryDto,
  discoveryTypeLabel,
  isDiscoveryTypeDisabled,
} from '../../types/dtos/discovery/DiscoveryDtos';

// Per-type "discovered / total" bars and lifetime reward totals from GET
// api/users/{id}/discoveries/summary - the same counts the in-game /discoveries menu head shows.
// Shared by the account page and the staff player profile. A type switched off in the Discovery
// settings is tagged "Disabled" for staff (showDisabled) and left out for players, unless
// overrides still enable some of its places.
export const DiscoverySummaryBars: React.FC<{ summary: DiscoverySummaryDto; showDisabled?: boolean }> = ({
  summary,
  showDisabled = false,
}) => {
  const types = summary.byType.filter((type) => showDisabled || !isDiscoveryTypeDisabled(type) || type.total > 0);
  return (
  <div className="space-y-3">
    {types.map((type) => {
      const percent = type.total > 0 ? Math.round((type.discovered / type.total) * 100) : 0;
      const label = discoveryTypeLabel(type.domainType);
      return (
        <div key={type.domainType}>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">
              {label}
              {showDisabled && isDiscoveryTypeDisabled(type) && (
                <span
                  className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"
                  title="Switched off in the Discovery settings: these places can't be discovered and players don't see this type."
                >
                  Disabled
                </span>
              )}
            </span>
            <span className="text-gray-600">{type.discovered} / {type.total}</span>
          </div>
          <div
            className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-label={`${label} discovered`}
            aria-valuemin={0}
            aria-valuemax={type.total}
            aria-valuenow={type.discovered}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      );
    })}
    <p className="text-sm text-gray-600">
      {summary.totalDiscovered} {summary.totalDiscovered === 1 ? 'place' : 'places'} discovered
      {(summary.totalCoins > 0 || summary.totalGems > 0 || summary.totalExp > 0) && (
        <>
          {' '}&middot; earned {formatAmount(summary.totalCoins)} coins, {formatAmount(summary.totalGems)} gems,{' '}
          {formatAmount(summary.totalExp)} XP
        </>
      )}
    </p>
  </div>
  );
};

/** "+1,300 coins, +5 gems, +25 XP", leaving out zero amounts; "-" when all are zero. */
export const formatDiscoveryRewards = (row: { coins: number; gems: number; exp: number }): string => {
  const parts: string[] = [];
  if (row.coins) parts.push(`${formatAmount(row.coins, true)} coins`);
  if (row.gems) parts.push(`${formatAmount(row.gems, true)} gems`);
  if (row.exp) parts.push(`${formatAmount(row.exp, true)} XP`);
  return parts.length > 0 ? parts.join(', ') : '-';
};

export const formatDiscoveryDate = (iso?: string | null): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};
