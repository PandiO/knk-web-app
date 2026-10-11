import { logging, Controllers, HttpMethod } from '../utils';
import { PrivacyDeletionRequestDto, PrivacyRequestStatus } from '../types/dtos/privacy/PrivacyDtos';
import { ObjectManager } from './objectManager';

// knk-web-api PrivacyController (api/privacy, KNG-34 link 6, DESIGN.md §F.14). Owner only: an exact
// grant of knk.owner.privacy.manage. Executing a request is irreversible - preview it first.
export class PrivacyClient extends ObjectManager {
  private static instance: PrivacyClient;

  public static getInstance() {
    if (!PrivacyClient.instance) {
      PrivacyClient.instance = new PrivacyClient();
      PrivacyClient.instance.logger = logging.getLogger('PrivacyClient');
    }
    return PrivacyClient.instance;
  }

  getRequests(status?: PrivacyRequestStatus): Promise<PrivacyDeletionRequestDto[]> {
    return this.invokeServiceCall(status ? { status } : null, 'deletion-requests', Controllers.Privacy, HttpMethod.Get);
  }

  createRequest(userId: number, note?: string): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({ userId, note: note || undefined }, 'deletion-requests', Controllers.Privacy, HttpMethod.Post);
  }

  /** dryRun: only the counts of what would be removed; nothing changes. */
  execute(id: number, dryRun: boolean): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({}, `deletion-requests/${id}/execute${dryRun ? '?dryRun=true' : ''}`, Controllers.Privacy, HttpMethod.Post);
  }

  cancel(id: number): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({}, `deletion-requests/${id}/cancel`, Controllers.Privacy, HttpMethod.Post);
  }
}

export const privacyClient = PrivacyClient.getInstance();
