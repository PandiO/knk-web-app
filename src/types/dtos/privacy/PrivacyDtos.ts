// GDPR deletion requests (KNG-34 link 6 + developer decisions 2026-10-03): knk-web-api
// Dtos/PrivacyDtos.cs. Players request (confirmed by email), staff file for players, the owner
// oversees; a confirmed request runs after a 5-day grace period in which it can be cancelled.

export type PrivacyRequestStatus = 'AwaitingConfirmation' | 'Pending' | 'Completed' | 'Cancelled' | 'Expired';

export type PrivacyRequestSource = 'Player' | 'Staff' | 'Owner';

/** Staff node to file/cancel a deletion request for a player (no email step). */
export const DATA_DELETION_REQUEST_NODE = 'knk.admin.privacy.request';

/** Counts only: what an erasure removes (dry run) or removed. */
export interface PrivacyDeletionResultDto {
  dryRun: boolean;
  userIds: number[];
  deleted: Record<string, number>;
  pseudonymizedUsers: number;
}

export interface PrivacyDeletionRequestDto {
  id: number;
  userId: number;
  username?: string | null;
  source: PrivacyRequestSource;
  requestedAt: string;
  /** Legal deadline: one month after confirmation. */
  dueAt: string;
  status: PrivacyRequestStatus;
  requestedByUserId: number;
  /** Staff/owner note; never returned to the player. */
  note?: string | null;
  /** Until when the emailed link works (AwaitingConfirmation only). */
  confirmationExpiresAt?: string | null;
  confirmedAt?: string | null;
  /** When the deletion runs; cancellable until then. */
  scheduledAt?: string | null;
  /** True when it runs automatically at scheduledAt. */
  autoExecute: boolean;
  cancelledAt?: string | null;
  cancelledByUserId?: number | null;
  executedAt?: string | null;
  executedByUserId?: number | null;
  result?: PrivacyDeletionResultDto | null;
}
