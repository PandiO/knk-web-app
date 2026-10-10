// World analytics (KNG-34 link 7, knk-workspace docs/specs/player-statistics/IMPLEMENTATION_PLAN.md §3.4).
// Mirrors knk-web-api Dtos/WorldAnalyticsDtos.cs. Anonymous aggregates: no shape carries a player.

/** Owner node of the analytics page; wildcards such as knk.* count (D24). */
export const OWNER_ANALYTICS_VIEW_NODE = 'knk.owner.analytics.view';

/** Inclusive local days (yyyy-MM-dd, the API's statistics time zone); both optional (default: last 7 days). */
export interface AnalyticsRange {
  from?: string;
  to?: string;
}

export interface HeatmapWorldDto {
  world: string;
  cellSizes: number[];
  samples: number;
}

export interface HeatmapCellDto {
  /** Cell index: blocks [x × cellSize, (x + 1) × cellSize). */
  x: number;
  z: number;
  samples: number;
}

export interface HeatmapDto {
  world: string;
  cellSize: number;
  from: string;
  to: string;
  cells: HeatmapCellDto[];
  maxSamples: number;
  totalSamples: number;
  truncated: boolean;
}

export type MenuStepOutcome = 'succeeded' | 'denied' | 'failed' | 'info';

export interface MenuFunnelStepCountDto {
  /** opened, back, closed or action:<actionTypeId>. */
  step: string;
  outcome: MenuStepOutcome;
  count: number;
}

export interface MenuFunnelDto {
  menuKey: string;
  opened: number;
  back: number;
  closed: number;
  steps: MenuFunnelStepCountDto[];
}

export interface MenuFunnelReportDto {
  from: string;
  to: string;
  menus: MenuFunnelDto[];
}

export type DomainInteractionKind = 'enter' | 'leave' | 'discover';

export interface DomainInteractionSummaryDto {
  domainId: number;
  /** Null when the domain no longer exists. */
  name?: string | null;
  regionId?: string | null;
  enter: number;
  leave: number;
  discover: number;
  /** Sum of each day's distinct visitors ("player-days"), not distinct players over the range. */
  visitorDays: number;
  peakDailyVisitors: number;
}

export interface DomainInteractionReportDto {
  from: string;
  to: string;
  kind?: DomainInteractionKind | null;
  domains: DomainInteractionSummaryDto[];
}
