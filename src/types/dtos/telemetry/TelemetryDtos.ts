// Diagnostic telemetry (KNG-34 link 6): knk-web-api Dtos/TelemetryDtos.cs. Owner only.

/** Owner nodes (knk-web-api Attributes/OwnerPermissions.cs). They need an exact grant in the API. */
export const OWNER_TELEMETRY_VIEW_NODE = 'knk.owner.telemetry.view';
export const OWNER_TELEMETRY_MANAGE_NODE = 'knk.owner.telemetry.manage';
export const OWNER_PRIVACY_MANAGE_NODE = 'knk.owner.privacy.manage';

/**
 * Owner nodes a wildcard never unlocks (KNG-34 D24, OwnerPermissions.ExactGrantOnly): personal
 * diagnostic data and GDPR deletion. World analytics and leaderboard exclusions accept knk.* etc.
 */
export const EXACT_GRANT_OWNER_NODES: ReadonlySet<string> = new Set([
  OWNER_TELEMETRY_VIEW_NODE,
  OWNER_TELEMETRY_MANAGE_NODE,
  OWNER_PRIVACY_MANAGE_NODE,
]);

export type TelemetryOutcome = 'Succeeded' | 'Denied' | 'Failed' | 'Info';
export type TelemetryLevel = 'Baseline' | 'Enhanced';
export type TelemetrySource = 'Plugin' | 'Api';

export type TelemetryPayload = Record<string, string | number | boolean>;

export interface TelemetryEventViewDto {
  id: number;
  eventId: string;
  name: string;
  schemaVersion: number;
  level: TelemetryLevel;
  source: TelemetrySource;
  occurredAt: string;
  receivedAt: string;
  serverName: string;
  serverSeq: number;
  appVersion: string;
  userId?: number | null;
  username?: string | null;
  sessionKey?: string | null;
  testRunId?: number | null;
  matchId?: number | null;
  correlationId?: string | null;
  feature: string;
  action: string;
  outcome: TelemetryOutcome;
  reasonCode?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  payload?: TelemetryPayload | null;
}

export interface TelemetryEventPageDto {
  items: TelemetryEventViewDto[];
  nextBefore?: string | null;
}

export interface TelemetryEventLinksDto {
  ledgerTransactionPublicIds: string[];
  siegeMatchId?: number | null;
}

export interface TelemetryEventDetailDto {
  event: TelemetryEventViewDto;
  related: TelemetryEventViewDto[];
  links: TelemetryEventLinksDto;
}

export interface TelemetryLedgerItemDto {
  publicId: string;
  reasonCode: string;
  correlationId?: string | null;
  currency: string;
  delta: number;
}

export interface TelemetrySiegeItemDto {
  matchId: number;
  status: string;
  kind: 'joined' | 'left' | 'ended';
  teamId?: number | null;
  kills: number;
  deaths: number;
  captures: number;
}

export interface TelemetryTimelineItemDto {
  kind: 'event' | 'ledger' | 'siege';
  at: string;
  event?: TelemetryEventViewDto | null;
  ledger?: TelemetryLedgerItemDto | null;
  siege?: TelemetrySiegeItemDto | null;
}

export interface TelemetryTimelineDto {
  userId: number;
  username?: string | null;
  from: string;
  to: string;
  truncated: boolean;
  items: TelemetryTimelineItemDto[];
}

export interface TelemetryTestRunDto {
  id: number;
  name: string;
  description?: string | null;
  startedAt: string;
  endedAt?: string | null;
  createdByUserId: number;
}

export interface EnhancedTargetDto {
  id: number;
  userId?: number | null;
  username?: string | null;
  testRunId?: number | null;
  expiresAt: string;
  createdByUserId: number;
  createdAt: string;
}

export interface TelemetryHealthDto {
  enabled: boolean;
  queueDepth: number;
  queueCapacity: number;
  droppedSinceStart: number;
  lastWriteAt?: string | null;
  eventsLast24h: number;
}

/** Filters of GET api/telemetry/events (all optional). */
export interface TelemetrySearchParams {
  userId?: number;
  from?: string;
  to?: string;
  sessionKey?: string;
  testRunId?: number;
  matchId?: number;
  correlationId?: string;
  name?: string;
  outcome?: TelemetryOutcome;
  limit?: number;
  before?: string;
}
