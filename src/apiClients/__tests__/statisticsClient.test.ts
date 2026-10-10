import { StatisticsClient } from '../statisticsClient';
import { PlayerClient } from '../playerClient';
import { Controllers, HttpMethod } from '../../utils';

describe('StatisticsClient', () => {
  const client = StatisticsClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ metrics: [], settings: [], groups: [] });
  });

  afterEach(() => {
    invokeSpy.mockRestore();
    (client as any).catalog = null;
  });

  it('reads a player with the period, and the date only when given', async () => {
    await client.getUserStatistics(7);
    expect(invokeSpy).toHaveBeenCalledWith({ period: 'lifetime' }, 'users/7', Controllers.Statistics, HttpMethod.Get);

    await client.getUserStatistics(7, 'week', '2026-10-01');
    expect(invokeSpy).toHaveBeenCalledWith({ period: 'week', date: '2026-10-01' }, 'users/7', Controllers.Statistics, HttpMethod.Get);
  });

  it('reads the catalogue once and retries after a failure', async () => {
    invokeSpy.mockRejectedValueOnce(new Error('down'));
    await expect(client.getCatalog()).rejects.toThrow('down');
    await client.getCatalog();
    await client.getCatalog();
    expect(invokeSpy).toHaveBeenCalledTimes(2);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'catalog', Controllers.Statistics, HttpMethod.Get);
  });

  it('pages the title history', async () => {
    await client.getTitleHistory(7, 2, 10);
    expect(invokeSpy).toHaveBeenCalledWith({ page: 2, pageSize: 10 }, 'users/7/title-history', Controllers.Statistics, HttpMethod.Get);
  });

  it('reads and atomically updates the visibility settings', async () => {
    await client.getVisibility(7);
    expect(invokeSpy).toHaveBeenCalledWith(null, 'users/7/visibility', Controllers.Statistics, HttpMethod.Get);

    const changes = [{ settingKey: 'pvp_kills', context: 'siege', expected: 'Nobody' as const, visibility: 'Everyone' as const }];
    await client.updateVisibility(7, changes);
    expect(invokeSpy).toHaveBeenCalledWith({ changes }, 'users/7/visibility', Controllers.Statistics, HttpMethod.Put);
  });
});

describe('PlayerClient', () => {
  const client = PlayerClient.getInstance();

  it('reads the public profile by name', async () => {
    const invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
    await client.getByName('Bob Smith');
    expect(invokeSpy).toHaveBeenCalledWith(null, 'by-name/Bob%20Smith', Controllers.Players, HttpMethod.Get);
    invokeSpy.mockRestore();
  });
});
