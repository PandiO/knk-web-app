import { PrivateMessageLogClient } from '../privateMessageLogClient';
import { Controllers, HttpMethod } from '../../utils';

describe('PrivateMessageLogClient', () => {
  const client = PrivateMessageLogClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25 });
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('search sends only the participant when no filter is set', async () => {
    await client.search({ participantUserId: 7 });
    expect(invokeSpy).toHaveBeenCalledWith({ participantUserId: 7 }, '', Controllers.PrivateMessageLog, HttpMethod.Get);
  });

  it('search sends every filter that is set', async () => {
    await client.search({
      participantUserId: 7,
      otherUserId: 12,
      from: '2026-09-20T00:00:00.000Z',
      to: '2026-09-27T00:00:00.000Z',
      pageNumber: 2,
      pageSize: 25,
    });
    expect(invokeSpy).toHaveBeenCalledWith({
      participantUserId: 7,
      otherUserId: 12,
      from: '2026-09-20T00:00:00.000Z',
      to: '2026-09-27T00:00:00.000Z',
      pageNumber: 2,
      pageSize: 25,
    }, '', Controllers.PrivateMessageLog, HttpMethod.Get);
  });

  it('targets the api/private-message-log route', () => {
    expect(Controllers.PrivateMessageLog).toBe('private-message-log');
  });
});
