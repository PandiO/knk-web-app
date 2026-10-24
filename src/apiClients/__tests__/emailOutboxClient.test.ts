import { EmailOutboxClient } from '../emailOutboxClient';
import { Controllers, HttpMethod } from '../../utils';

describe('EmailOutboxClient', () => {
  const client = EmailOutboxClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({});
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('list sends only the filters that are set', async () => {
    await client.list({ pageNumber: 2, pageSize: 25, status: '', kind: 'PasswordReset' });
    expect(invokeSpy).toHaveBeenCalledWith({ pageNumber: 2, pageSize: 25, kind: 'PasswordReset' }, '', Controllers.EmailOutbox, HttpMethod.Get);
  });

  it('sendTest posts to test', async () => {
    await client.sendTest();
    expect(invokeSpy).toHaveBeenCalledWith(null, 'test', Controllers.EmailOutbox, HttpMethod.Post);
  });

  it('retry posts to {id}/retry', async () => {
    await client.retry(42);
    expect(invokeSpy).toHaveBeenCalledWith(null, '42/retry', Controllers.EmailOutbox, HttpMethod.Post);
  });
});
