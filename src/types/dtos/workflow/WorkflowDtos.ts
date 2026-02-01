// Workflow and WorldTask DTOs matching backend contracts

export interface WorkflowSessionCreateDto {
  userId: number;
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
  status: string; // Pending, InProgress, Completed, Failed, Cancelled
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
}

export interface UpdateWorldTaskStatusRequest {
  status: string;
  outputJson?: string;
  errorMessage?: string;
}
