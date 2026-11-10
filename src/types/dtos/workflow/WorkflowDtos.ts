// Workflow and WorldTask DTOs matching backend contracts

export interface WorkflowSessionCreateDto {
  // No userId: the API makes the logged-in user the owner (#186).
  formConfigurationId?: number;
  entityTypeName?: string;
  entityId?: number;
}

export interface WorkflowSessionReadDto {
  id: number;
  sessionGuid: string;
  userId: number;
  formConfigurationId?: number;
  entityTypeName?: string;
  entityId?: number;
  currentStepIndex: number;
  status: string; // InProgress, Paused, Completed, Abandoned, Cancelled
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface StepProgressReadDto {
  id: number;
  workflowSessionId: number;
  stepKey: string;
  stepIndex: number;
  status: string; // Pending, InProgress, Completed
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface WorldTaskCreateDto {
  workflowSessionId: number;
  stepNumber?: number;
  stepKey?: string;
  fieldName?: string;
  taskType: string;
  assignedUserId?: number;
  inputJson?: string;
  /** PandiO/knk-workspace#180: the draft whose field this task fills (DESIGN §8.7). */
  formSubmissionProgressId?: number;
  /** #181 (DESIGN §8.3): how the task reaches the game; the API's default is 'auto'. */
  deliver?: WorldTaskDelivery;
}

/**
 * #181: 'auto' = offered to and claimed by you when you are online in game (else the task code), 'code' = task code
 * only, 'queue' = offered when your current task ends, 'replace' = your current task is handed back (it keeps its
 * task code) and this one offered, { userId } = "Hand off to…" (Accept/Decline in game).
 */
export type WorldTaskDelivery = 'auto' | 'code' | 'queue' | 'replace' | { userId: number };

/** #181: GET api/WorldTasks/active-for-me (the busy check). */
export interface WorldTaskActiveForMeDto {
  task?: WorldTaskReadDto | null;
  formName?: string | null;
  queued: number;
}

/** #181: GET api/Presence/me. */
export interface PresenceMeDto {
  online: boolean;
  serverId?: string | null;
  hasMinecraftAccount: boolean;
}

/** #181: GET api/Presence/online-staff (the "Hand off to…" picker). */
export interface OnlineStaffDto {
  userId: number;
  username: string;
  serverId: string;
  world?: string | null;
}

/** #181: the WorldTaskUpdated payload (DESIGN §6.5); no task code, no output. */
export interface WorldTaskUpdatedPayload {
  taskId: number;
  status: string;
  offerState: string;
  targetUserId?: number | null;
  targetUsername?: string | null;
  claimedByMinecraftUsername?: string | null;
  claimedByServerId?: string | null;
  errorMessage?: string | null;
  formSubmissionProgressId?: number | null;
  fieldName?: string | null;
  expiresAt?: string | null;
  offeredAt?: string | null;
  releaseCount: number;
}

export interface CancelTaskDto {
  reason?: string;
}

export interface ClaimTaskDto {
  claimedByServerId?: string;
  claimedByMinecraftUsername?: string;
}

export interface CompleteTaskDto {
  outputJson: string;
}

export interface FailTaskDto {
  errorMessage: string;
}

export interface WorldTaskReadDto {
  id: number;
  workflowSessionId: number;
  stepNumber?: number;
  stepKey?: string;
  fieldName?: string;
  taskType: string;
  status: string; // Pending, InProgress, Completed, Failed, Cancelled, Expired (#180)
  /** The task code (the API column keeps the old name). */
  linkCode?: string;
  assignedUserId?: number;
  claimedByServerId?: string;
  claimedByMinecraftUsername?: string;
  inputJson?: string;
  outputJson?: string;
  errorMessage?: string;
  createdAt: string;
  claimedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  // PandiO/knk-workspace#180
  entityType?: string;
  createdByUserId?: number;
  claimedByUuid?: string;
  claimedByUserId?: number;
  /** Pending tasks expire at this time (30 min after create or release). */
  expiresAt?: string;
  /** A claim lasts until this time unless the game server renews it. */
  leaseUntil?: string;
  releaseCount?: number;
  formSubmissionProgressId?: number;
  /** When the result was written into the draft; a completed task without it is applied on reattach. */
  appliedAt?: string;
  targetUserId?: number;
  /** #181: None, Offered, Accepted, Declined, TimedOut, Queued, Busy. */
  offerState?: string;
  offeredAt?: string;
  targetUsername?: string;
}

export interface UpdateWorldTaskStatusRequest {
  status: string;
  outputJson?: string;
  errorMessage?: string;
}
