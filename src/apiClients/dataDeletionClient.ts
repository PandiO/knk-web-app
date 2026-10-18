import { logging, Controllers, HttpMethod } from '../utils';
import { PrivacyDeletionRequestDto } from '../types/dtos/privacy/PrivacyDtos';
import { ObjectManager } from './objectManager';

// knk-web-api DataDeletionController (api/data-deletion, KNG-34 developer decisions 2026-10-03).
// A signed-in player requests deletion of their own data and confirms it through an emailed link;
// staff with knk.admin.privacy.request file the same request for a player without the email step.
// A confirmed request runs after a 5-day grace period, cancellable until then. "No request" is a
// 204 and comes back as null.
export class DataDeletionClient extends ObjectManager {
  private static instance: DataDeletionClient;

  public static getInstance() {
    if (!DataDeletionClient.instance) {
      DataDeletionClient.instance = new DataDeletionClient();
      DataDeletionClient.instance.logger = logging.getLogger('DataDeletionClient');
    }
    return DataDeletionClient.instance;
  }

  /** The signed-in player's open request, or null. */
  getMine(): Promise<PrivacyDeletionRequestDto | null> {
    return this.invokeServiceCall(null, 'me', Controllers.DataDeletion, HttpMethod.Get);
  }

  /** Emails a confirmation link (again, if unconfirmed). 409 AlreadyScheduled / EmailRequired. */
  requestMine(): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({}, 'me', Controllers.DataDeletion, HttpMethod.Post);
  }

  cancelMine(): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({}, 'me/cancel', Controllers.DataDeletion, HttpMethod.Post);
  }

  /** The token from the emailed link; no sign-in needed. 400 InvalidToken. */
  confirm(token: string): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({ token }, 'confirm', Controllers.DataDeletion, HttpMethod.Post);
  }

  /** Staff: the player's open request, or null. */
  getForPlayer(userId: number): Promise<PrivacyDeletionRequestDto | null> {
    return this.invokeServiceCall(null, `users/${userId}`, Controllers.DataDeletion, HttpMethod.Get);
  }

  /** Staff: files a request for the player (no email step); it runs after the grace period. */
  fileForPlayer(userId: number, note?: string): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({ note: note || undefined }, `users/${userId}`, Controllers.DataDeletion, HttpMethod.Post);
  }

  cancelForPlayer(userId: number): Promise<PrivacyDeletionRequestDto> {
    return this.invokeServiceCall({}, `users/${userId}/cancel`, Controllers.DataDeletion, HttpMethod.Post);
  }
}

export const dataDeletionClient = DataDeletionClient.getInstance();
