import { DiscoveryClient } from '../discoveryClient';
import { Controllers, HttpMethod } from '../../utils';

describe('DiscoveryClient', () => {
  const client = DiscoveryClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('posts the progress query to api/users/{id}/discoveries/progress', async () => {
    const query = { pageNumber: 2, pageSize: 10, filters: { status: 'discovered' as const }, sortBy: 'discoveredAt' as const, sortDescending: true };
    await client.getProgress(7, query);
    expect(invokeSpy).toHaveBeenCalledWith(query, '7/discoveries/progress', Controllers.Users, HttpMethod.Post);
  });

  it('gets the summary from api/users/{id}/discoveries/summary', async () => {
    await client.getSummary(7);
    expect(invokeSpy).toHaveBeenCalledWith(null, '7/discoveries/summary', Controllers.Users, HttpMethod.Get);
  });

  it('resets one discovery with DELETE api/users/{id}/discoveries/{domainId}', async () => {
    await client.reset(7, 42);
    expect(invokeSpy).toHaveBeenCalledWith(null, '7/discoveries/42', Controllers.Users, HttpMethod.Delete);
  });

  it('reads and writes the type rules under api/discovery-rewards', async () => {
    await client.getRules();
    expect(invokeSpy).toHaveBeenCalledWith(null, '', Controllers.DiscoveryRewards, HttpMethod.Get);

    const rule = {
      isEnabled: true, expUnitsMin: 1, expUnitsMax: 4, coinSalaryHoursMin: 2, coinSalaryHoursMax: 8,
      gemsMin: 5, gemsMax: 15, includeAncestors: false,
    };
    await client.updateRule('Town', rule);
    expect(invokeSpy).toHaveBeenCalledWith(rule, 'Town', Controllers.DiscoveryRewards, HttpMethod.Put);
  });

  it('lists, upserts and deletes overrides', async () => {
    await client.getOverrides();
    expect(invokeSpy).toHaveBeenCalledWith(null, 'overrides', Controllers.DiscoveryRewards, HttpMethod.Get);

    await client.upsertOverride(42, { isEnabled: false });
    expect(invokeSpy).toHaveBeenCalledWith({ isEnabled: false }, 'overrides/42', Controllers.DiscoveryRewards, HttpMethod.Put);

    await client.deleteOverride(42);
    expect(invokeSpy).toHaveBeenCalledWith(null, 'overrides/42', Controllers.DiscoveryRewards, HttpMethod.Delete);
  });

  it('asks for a preview by type or by domain', async () => {
    await client.getPreview({ domainType: 'District' });
    expect(invokeSpy).toHaveBeenCalledWith({ domainType: 'District' }, 'preview', Controllers.DiscoveryRewards, HttpMethod.Get);

    await client.getPreview({ domainId: 42 });
    expect(invokeSpy).toHaveBeenCalledWith({ domainId: 42 }, 'preview', Controllers.DiscoveryRewards, HttpMethod.Get);
  });

  it('sends only the stats parameters that are set', async () => {
    await client.getStats();
    expect(invokeSpy).toHaveBeenCalledWith({}, 'stats', Controllers.Discoveries, HttpMethod.Get);

    await client.getStats({ pageNumber: 2, pageSize: 25, domainType: 'Town', sortBy: 'discoverers', sortDescending: false });
    expect(invokeSpy).toHaveBeenCalledWith(
      { pageNumber: 2, pageSize: 25, domainType: 'Town', sortBy: 'discoverers', sortDescending: false },
      'stats', Controllers.Discoveries, HttpMethod.Get);
  });

  it('targets the api/discoveries and api/discovery-rewards routes', () => {
    expect(Controllers.Discoveries).toBe('discoveries');
    expect(Controllers.DiscoveryRewards).toBe('discovery-rewards');
  });
});
