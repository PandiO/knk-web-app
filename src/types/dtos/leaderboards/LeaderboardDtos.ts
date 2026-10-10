// Leaderboards (KNG-34; knk-web-api Dtos/LeaderboardDtos.cs, IMPLEMENTATION_PLAN.md §3.2,
// DESIGN.md §F.11). Served from snapshots refreshed every few minutes.

import { StatisticUnit } from '../statistics/StatisticsDtos';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'lifetime';
export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = ['weekly', 'monthly', 'lifetime'];

export const leaderboardPeriodLabel = (period: LeaderboardPeriod): string =>
  ({ weekly: 'This week', monthly: 'This month', lifetime: 'All time' })[period];

/** knk-web-api OwnerPermissions.LeaderboardManage - exclusions (wildcards count, D24). */
export const LEADERBOARD_OWNER_NODE = 'knk.owner.leaderboard.manage';

export interface LeaderboardBoardDto {
  boardKey: string;
  metric: string;
  context?: string | null;
  label: string;
  unit: StatisticUnit;
  periods: LeaderboardPeriod[];
  /**
   * Always-public metrics (active playtime, XP) rank everyone and can be read signed out; the
   * others rank only players who show the statistic to everyone and need a signed-in viewer.
   */
  alwaysPublic: boolean;
}

export interface LeaderboardEntryDto {
  rank: number;
  userId: number;
  username: string;
  value: number;
  rawValue: number;
}

export interface LeaderboardViewDto {
  boardKey: string;
  label: string;
  unit: StatisticUnit;
  period: LeaderboardPeriod;
  periodStart?: string | null;
  /** null while no snapshot exists yet. */
  generatedAt?: string | null;
  totalRanked: number;
  entries: LeaderboardEntryDto[];
  viewer?: { rank: number; value: number; rawValue: number } | null;
}
