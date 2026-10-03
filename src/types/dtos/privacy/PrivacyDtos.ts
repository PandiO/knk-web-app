// GDPR deletion requests (KNG-34 link 6): knk-web-api Dtos/PrivacyDtos.cs. Owner only.

export type PrivacyRequestStatus = 'Pending' | 'Completed' | 'Cancelled';

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
  requestedAt: string;
  dueAt: string;
  autoExecuteAt?: string | null;
  status: PrivacyRequestStatus;
  requestedByUserId: number;
  note?: string | null;
  executedAt?: string | null;
  executedByUserId?: number | null;
  result?: PrivacyDeletionResultDto | null;
}
