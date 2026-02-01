import { Controllers, HttpMethod } from "../utils/enums";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";
import { StepProgressReadDto, WorkflowSessionCreateDto, WorkflowSessionReadDto } from "../types/dtos/workflow/WorkflowDtos";

export class WorkflowClient extends ObjectManager {
  private static instance: WorkflowClient;

  public static getInstance() {
    if (!WorkflowClient.instance) {
      WorkflowClient.instance = new WorkflowClient();
      WorkflowClient.instance.logger = logging.getLogger('WorkflowClient');
    }
    return WorkflowClient.instance;
  }

  createSession(data: WorkflowSessionCreateDto): Promise<WorkflowSessionReadDto> {
    return this.invokeServiceCall(data, '', Controllers.Workflows, HttpMethod.Post);
  }

  getById(id: number): Promise<WorkflowSessionReadDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.Workflows, HttpMethod.Get);
  }

  resume(id: number): Promise<WorkflowSessionReadDto> {
    return this.invokeServiceCall({}, `${id}/resume`, Controllers.Workflows, HttpMethod.Post);
  }

  getProgress(id: number): Promise<StepProgressReadDto[]> {
    return this.invokeServiceCall(null, `${id}/progress`, Controllers.Workflows, HttpMethod.Get);
  }

  completeStep(id: number, stepKey: string, stepIndex?: number): Promise<StepProgressReadDto> {
    const query = (stepIndex ?? stepIndex === 0) ? `?stepIndex=${stepIndex}` : '';
    return this.invokeServiceCall({}, `${id}/steps/${encodeURIComponent(stepKey)}/complete${query}`, Controllers.Workflows, HttpMethod.Post);
  }

  updateStep(id: number, stepNumber: number, stepData: any): Promise<WorkflowSessionReadDto> {
    return this.invokeServiceCall({ stepNumber, stepData }, `${id}/steps/${stepNumber}`, Controllers.Workflows, HttpMethod.Put);
  }

  finalize(id: number): Promise<WorkflowSessionReadDto> {
    return this.invokeServiceCall({}, `${id}/finalize`, Controllers.Workflows, HttpMethod.Post);
  }

  delete(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.Workflows, HttpMethod.Delete);
  }
}

export const workflowClient = WorkflowClient.getInstance();
