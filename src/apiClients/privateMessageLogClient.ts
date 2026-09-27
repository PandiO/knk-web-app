import { logging, Controllers, HttpMethod } from '../utils';
import { PrivateMessageLogPagedResultDto, PrivateMessageLogQuery } from '../types/dtos/privateMessageLog';
import { ObjectManager } from './objectManager';

// docs/specs/private-messages/IMPLEMENTATION_PLAN.md Phase 4. Reading a player's private messages
// needs knk.pmlog.read (the API answers 403 otherwise) and every call is itself written to the
// audit log as PrivateMessagesViewed, so only call this when staff actually asked to read them.
export class PrivateMessageLogClient extends ObjectManager {
  private static instance: PrivateMessageLogClient;

  public static getInstance() {
    if (!PrivateMessageLogClient.instance) {
      PrivateMessageLogClient.instance = new PrivateMessageLogClient();
      PrivateMessageLogClient.instance.logger = logging.getLogger('PrivateMessageLogClient');
    }
    return PrivateMessageLogClient.instance;
  }

  search(query: PrivateMessageLogQuery): Promise<PrivateMessageLogPagedResultDto> {
    // Only the filters that are set - serviceCall would send an undefined one as "undefined".
    const params: Record<string, string | number> = { participantUserId: query.participantUserId };
    if (query.otherUserId !== undefined) params.otherUserId = query.otherUserId;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.pageNumber !== undefined) params.pageNumber = query.pageNumber;
    if (query.pageSize !== undefined) params.pageSize = query.pageSize;
    return this.invokeServiceCall(params, '', Controllers.PrivateMessageLog, HttpMethod.Get);
  }
}

export const privateMessageLogClient = PrivateMessageLogClient.getInstance();
