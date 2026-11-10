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
  FailTaskDto,
  CancelTaskDto,
  WorldTaskActiveForMeDto,
  PresenceMeDto,
  OnlineStaffDto,
  WorldTaskDelivery,
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

  /** PandiO/knk-workspace#180: ends an open task (Capture again, Try again, leaving the form, "Cancel task"). */
  cancel(id: number, payload: CancelTaskDto = {}): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall(payload, `${id}/cancel`, Controllers.WorldTasks, HttpMethod.Post);
  }

  /**
   * PandiO/knk-workspace#240 "Send again": offers a waiting task again (auto to you, queue, replace, or a hand-off).
   * 409 while it is offered, once it is no longer waiting, or for auto/replace while you are not online in game.
   */
  offer(id: number, deliver: Exclude<WorldTaskDelivery, 'code'>): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall({ deliver }, `${id}/offer`, Controllers.WorldTasks, HttpMethod.Post);
  }

  /** #180 (DESIGN §8.7): the completed result is in the draft now. */
  markApplied(id: number): Promise<WorldTaskReadDto> {
    return this.invokeServiceCall({}, `${id}/applied`, Controllers.WorldTasks, HttpMethod.Post);
  }

  /** #180: the open tasks of a workflow session. */
  getOpenBySession(sessionId: number): Promise<WorldTaskReadDto[]> {
    return this.invokeServiceCall(null, `session/${sessionId}/open`, Controllers.WorldTasks, HttpMethod.Get);
  }

  /** #181 (DESIGN §8.3): the busy check: the task you hold in game, its form, and your queue. */
  getActiveForMe(): Promise<WorldTaskActiveForMeDto> {
    return this.invokeServiceCall(null, 'active-for-me', Controllers.WorldTasks, HttpMethod.Get);
  }

  /** #181: whether you are online in game now (presence from the game hub; false while realtime is off). */
  getMyPresence(): Promise<PresenceMeDto> {
    return this.invokeServiceCall(null, 'me', Controllers.Presence, HttpMethod.Get);
  }

  /** #181: online players who hold knk.tasks ("Hand off to…"). */
  getOnlineStaff(): Promise<OnlineStaffDto[]> {
    return this.invokeServiceCall(null, 'online-staff', Controllers.Presence, HttpMethod.Get);
  }

  delete(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.WorldTasks, HttpMethod.Delete);
  }
}

export const worldTaskClient = WorldTaskClient.getInstance();
