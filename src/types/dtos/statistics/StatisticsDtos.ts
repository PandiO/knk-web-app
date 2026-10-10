// Player statistics (KNG-34; knk-web-api Dtos/StatisticsDtos.cs and Dtos/PlayerProfileDtos.cs,
// knk-workspace docs/specs/player-statistics/IMPLEMENTATION_PLAN.md §3.1-§3.2). The API applies the
// player's visibility settings to every read - the UI renders what it gets.

/** knk-web-api StaffPermissions.ViewStatistics: staff see all of a player's statistics (read-only). */
export const STATISTICS_STAFF_NODE = 'knk.admin.statistics.view';

export type StatisticVisibility = 'Nobody' | 'Friends' | 'Everyone';
export const STATISTIC_VISIBILITIES: readonly StatisticVisibility[] = ['Nobody', 'Friends', 'Everyone'];

export type StatisticUnit = 'Count' | 'Seconds' | 'Blocks' | 'Points';
export type StatisticsPeriod = 'lifetime' | 'day' | 'week' | 'month';
export const STATISTICS_PERIODS: readonly StatisticsPeriod[] = ['lifetime', 'day', 'week', 'month'];

export const statisticsPeriodLabel = (period: StatisticsPeriod): string =>
  ({ lifetime: 'Lifetime', day: 'Today', week: 'This week', month: 'This month' })[period];

/** "Friends" is stored but shows nothing until the friends system exists (KNG-35). */
export const FRIENDS_NOTE = 'Friends-only shows nothing until the friends system exists.';

// ===== GET api/statistics/catalog

export interface StatisticsCatalogMetricDto {
  key: string;
  settingKey?: string | null;
  aggregation: 'Sum' | 'Max';
  unit: StatisticUnit;
  contextual: boolean;
  visibility: 'AlwaysPublic' | 'Configurable' | 'Internal';
  group: string;
  label: string;
}

export interface StatisticsCatalogSettingDto {
  settingKey: string;
  group: string;
  label: string;
  contextual: boolean;
}

export interface StatisticsCatalogGroupDto {
  key: string;
  label: string;
  settingKeys: string[];
}

export interface StatisticsCatalogDto {
  timeZone: string;
  contexts?: string[];
  metrics: StatisticsCatalogMetricDto[];
  settings: StatisticsCatalogSettingDto[];
  groups: StatisticsCatalogGroupDto[];
}

// ===== GET api/statistics/users/{id}

export interface PlayerStatisticsProfileDto {
  titleName?: string | null;
  titleBracketId?: number | null;
  experience: number;
  coins: number;
  gems: number;
  firstJoinedAt?: string | null;
  activePlaytimeSeconds: number;
  afkSeconds: number;
}

export interface PlayerStatisticContextValueDto {
  context: string;
  value: number;
  rawValue: number;
}

export interface PlayerStatisticMetricDto {
  key: string;
  settingKey?: string | null;
  /** Display-rounded; null when the total is hidden but some contexts are visible. */
  value: number | null;
  rawValue: number | null;
  unit: StatisticUnit;
  aggregation: 'Sum' | 'Max';
  contexts?: PlayerStatisticContextValueDto[] | null;
}

export interface PlayerStatisticsDto {
  userId: number;
  username: string;
  period: StatisticsPeriod;
  periodStart?: string | null;
  periodEndExclusive?: string | null;
  timeZone: string;
  viewer: 'self' | 'staff' | 'signedIn' | 'anonymous';
  profile: PlayerStatisticsProfileDto;
  metrics: PlayerStatisticMetricDto[];
  economy?: { coinsEarned: number; coinsSpent: number; gemsEarned: number; gemsSpent: number } | null;
  discoveries?: { total: number; towns: number; districts: number; structures: number } | null;
}

// ===== title history

export interface TitleChangeDto {
  changedAt: string;
  fromTitleName?: string | null;
  toTitleName: string;
  direction: 'Promotion' | 'Demotion';
}

export interface StatisticsPagedResultDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

// ===== visibility

export interface StatisticsVisibilityContextDto {
  context: string;
  visibility: StatisticVisibility;
  /** False: the context shows the inherited metric-level value. */
  isOverride: boolean;
}

export interface StatisticsVisibilitySettingDto {
  settingKey: string;
  group: string;
  label: string;
  contextual: boolean;
  visibility: StatisticVisibility;
  contexts: StatisticsVisibilityContextDto[];
}

export interface StatisticsVisibilityDto {
  userId: number;
  friendsAvailable: boolean;
  settings: StatisticsVisibilitySettingDto[];
}

/** One change of an atomic update; context "" = the metric level; expected = the value shown. */
export interface StatisticsVisibilityChangeDto {
  settingKey: string;
  context: string;
  expected: StatisticVisibility;
  visibility: StatisticVisibility;
}

/** The 409 body of PUT …/visibility: nothing was written; current = the settings now. */
export interface StatisticsVisibilityConflictDto {
  error: 'VisibilityConflict';
  message: string;
  current: StatisticsVisibilityDto;
}

// ===== GET api/players/by-name/{username}

/** Always-public profile; no online flag, email or UUID (vanish must not leak). */
export interface PublicPlayerProfileDto {
  userId: number;
  username: string;
  titleName?: string | null;
  experience: number;
  coins: number;
  gems: number;
  firstJoinedAt?: string | null;
  activePlaytimeSeconds: number;
  afkSeconds: number;
}

// ===== formatting (DESIGN.md §F.10 - the API already rounded the values)

/** "2d 3h", "3h 25m", "12m", "45s". */
export const formatDuration = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${s}s`;
};

const whole = (value: number): string => Math.round(value).toLocaleString('en-US');

/** A value in its unit: durations, whole blocks (the highest fall with one decimal), whole numbers. */
export const formatStatistic = (metricKey: string, unit: StatisticUnit, value: number): string => {
  switch (unit) {
    case 'Seconds':
      return formatDuration(value);
    case 'Blocks':
      return metricKey === 'highest_fall' ? `${value.toFixed(1)} blocks` : `${Math.floor(value).toLocaleString('en-US')} blocks`;
    default:
      return whole(value);
  }
};

/** "open_world" → "Open world", "siege" → "Siege". */
export const contextLabel = (context: string): string => {
  if (!context) return 'All';
  const words = context.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const formatStatisticsDate = (iso?: string | null): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};
