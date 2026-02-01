// Enums and types for workflow state management

export enum WorkflowState {
  InProgress = 'InProgress',
  Paused = 'Paused',
  Completed = 'Completed',
  Abandoned = 'Abandoned',
  Cancelled = 'Cancelled'
}

export enum TaskStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

export enum StepStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Completed = 'Completed'
}

export interface StepDefinition {
  stepNumber: number;
  stepKey: string;
  name: string;
  requiresMinecraft: boolean;
  fields: string[]; // Field names for this step
}

export interface WorkflowContext {
  workflowId: number;
  currentStep: number;
  steps: StepDefinition[];
  stepData: Record<number, any>;
}
