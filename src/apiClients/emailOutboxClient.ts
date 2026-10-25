import { logging, Controllers, HttpMethod } from '../utils';
import { EmailOutboxItemDto, EmailOutboxPageDto, EmailOutboxQuery } from '../types/dtos/email/EmailOutboxDtos';
import { ObjectManager } from './objectManager';

// The mail log (KNG-206). Every call needs knk.admin.config; the API answers 403 otherwise.
export class EmailOutboxClient extends ObjectManager {
  private static instance: EmailOutboxClient;

  public static getInstance() {
    if (!EmailOutboxClient.instance) {
      EmailOutboxClient.instance = new EmailOutboxClient();
      EmailOutboxClient.instance.logger = logging.getLogger('EmailOutboxClient');
    }
    return EmailOutboxClient.instance;
  }

  list(query: EmailOutboxQuery = {}): Promise<EmailOutboxPageDto> {
    // Only the filters that are set - serviceCall would send an undefined one as "undefined".
    const params: Record<string, string | number> = {};
    if (query.pageNumber !== undefined) params.pageNumber = query.pageNumber;
    if (query.pageSize !== undefined) params.pageSize = query.pageSize;
    if (query.status) params.status = query.status;
    if (query.kind) params.kind = query.kind;
    return this.invokeServiceCall(params, '', Controllers.EmailOutbox, HttpMethod.Get);
  }

  /** Queues a test mail to the caller's own address (400 when the account has none). */
  sendTest(): Promise<EmailOutboxItemDto> {
    return this.invokeServiceCall(null, 'test', Controllers.EmailOutbox, HttpMethod.Post);
  }

  /** Puts a Failed mail back in the queue (409 when its content was removed). */
  retry(id: number): Promise<EmailOutboxItemDto> {
    return this.invokeServiceCall(null, `${id}/retry`, Controllers.EmailOutbox, HttpMethod.Post);
  }
}

export const emailOutboxClient = EmailOutboxClient.getInstance();
