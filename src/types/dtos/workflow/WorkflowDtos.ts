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
  offerState?: string;
}

export interface UpdateWorldTaskStatusRequest {
  status: string;
  outputJson?: string;
  errorMessage?: string;
}
