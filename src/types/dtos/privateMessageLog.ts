// docs/specs/private-messages/DESIGN.md §3.2/§3.4 - mirrors knk-web-api's
// GET api/private-message-log (PrivateMessageLogController, PrivateMessageLogDtos.cs).

/** knk-web-api PrivateMessageOutcome, serialized as its PascalCase name. */
export type PrivateMessageOutcome = 'Delivered' | 'BlockedIgnored' | 'BlockedRateLimited' | 'BlockedFrozen';

export interface PrivateMessageLogEntryDto {
  id: number;
  sentAt: string;
  /** Null for the console. */
  senderUserId?: number | null;
  senderName: string;
  /** Null for the console. */
  recipientUserId?: number | null;
  recipientName: string;
  content: string;
  outcome: PrivateMessageOutcome;
  /** Sent with /reply rather than /msg. */
  viaReply: boolean;
}

/** Filters of GET api/private-message-log - one player's messages, newest first. */
export interface PrivateMessageLogQuery {
  /** The player whose messages (sent and received) to show. */
  participantUserId: number;
  /** Only the conversation with this player. */
  otherUserId?: number;
  /** Sent at or after (ISO, UTC). */
  from?: string;
  /** Sent before (ISO, UTC). */
  to?: string;
  /** 1-based. */
  pageNumber?: number;
  /** Capped at 100 by the API. */
  pageSize?: number;
}

// Same wire shape as GET api/audit-log (knk-web-api PagedResultDto: pageNumber/pageSize, no
// totalPages) - see AuditLogPagedResultDto in userManagement/UserProfileSummaryDtos.ts.
export interface PrivateMessageLogPagedResultDto {
  items: PrivateMessageLogEntryDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}
