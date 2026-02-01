import { Controllers, HttpMethod } from "../utils/enums";
import { ObjectManager } from "./objectManager";
import { logging } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import { 
  UpdateWorldTaskStatusRequest, 
  WorldTaskCreateDto, 
  WorldTaskReadDto,
  ClaimTaskDto,
  CompleteTaskDto,
  FailTaskDto
} from "../types/dtos/workflow/WorkflowDtos";

export class WorldTaskClient extends ObjectManager {
  private static instance: WorldTaskClient;

  public static getInstance() {
    if (!WorldTaskClient.instance) {
      WorldTaskClient.instance = new WorldTaskClient();
      WorldTaskClient.instance.logger = logging.getLogger('WorldTaskClient');
    }
    return WorldTaskClient.instance;
  }

  create(data: WorldTaskCreateDto): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(data, '', Controllers.WorldTasks, HttpMethod.Post);
  }

  getById(id: number): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.WorldTasks, HttpMethod.Get);
  }

  getByLinkCode(linkCode: string): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(null, `by-link-code/${encodeURIComponent(linkCode)}`, Controllers.WorldTasks, HttpMethod.Get);
  }

  listByStatus(status: string, serverId?: string): Promise<WorldTaskReadDto[]> {
    const query = serverId ? `?serverId=${encodeURIComponent(serverId)}` : '';
    return this.invokeServiceCall(null, `status/${encodeURIComponent(status)}${query}`, Controllers.WorldTasks, HttpMethod.Get);
  }

  getBySession(sessionId: number): Promise<WorldTaskReadDto[]> {
    return this.invokeServiceCall(null, `session/${sessionId}`, Controllers.WorldTasks, HttpMethod.Get);
  }

  getByUser(userId: number, query: PagedQueryDto): Promise<PagedResultDto<WorldTaskReadDto>> {
    return this.invokeServiceCall(query, `user/${userId}/search`, Controllers.WorldTasks, HttpMethod.Post);
  }

  search(query: PagedQueryDto): Promise<PagedResultDto<WorldTaskReadDto>> {
    return this.invokeServiceCall(query, 'search', Controllers.WorldTasks, HttpMethod.Post);
  }

  updateStatus(id: number, payload: UpdateWorldTaskStatusRequest): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(payload, `${id}/status`, Controllers.WorldTasks, HttpMethod.Post);
  }

  claim(id: number, payload: ClaimTaskDto): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(payload, `${id}/claim`, Controllers.WorldTasks, HttpMethod.Post);
  }

  complete(id: number, payload: CompleteTaskDto): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(payload, `${id}/complete`, Controllers.WorldTasks, HttpMethod.Post);
  }

  fail(id: number, payload: FailTaskDto): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(payload, `${id}/fail`, Controllers.WorldTasks, HttpMethod.Post);
  }

  delete(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.WorldTasks, HttpMethod.Delete);
  }
}

export const worldTaskClient = WorldTaskClient.getInstance();
