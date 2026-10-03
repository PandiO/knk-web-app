import { TelemetryClient } from '../telemetryClient';
import { PrivacyClient } from '../privacyClient';
import { WorldAnalyticsClient } from '../worldAnalyticsClient';
import { Controllers, HttpMethod } from '../../utils';

describe('TelemetryClient (api/telemetry, KNG-34 link 6)', () => {
  const client = TelemetryClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => invokeSpy.mockRestore());

  it('searches with only the filters that are set', async () => {
    await client.search({ userId: 7, name: 'siege.match_join', correlationId: '', before: undefined, outcome: 'Failed' });
    expect(invokeSpy).toHaveBeenCalledWith({ userId: 7, name: 'siege.match_join', outcome: 'Failed' }, 'events', Controllers.Telemetry, HttpMethod.Get);

    await client.search({});
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'events', Controllers.Telemetry, HttpMethod.Get);
  });

  it('reads an event, a timeline and the health', async () => {
    await client.getEvent('a b');
    expect(invokeSpy).toHaveBeenCalledWith(null, 'events/a%20b', Controllers.Telemetry, HttpMethod.Get);
    await client.getTimeline(7, '2026-10-03T10:00:00.000Z');
    expect(invokeSpy).toHaveBeenLastCalledWith({ from: '2026-10-03T10:00:00.000Z' }, 'timeline/7', Controllers.Telemetry, HttpMethod.Get);
    await client.getHealth();
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'health', Controllers.Telemetry, HttpMethod.Get);
  });

  it('manages test runs and enhanced targets', async () => {
    await client.startTestRun('Siege alpha');
    expect(invokeSpy).toHaveBeenLastCalledWith({ name: 'Siege alpha', description: undefined }, 'test-runs', Controllers.Telemetry, HttpMethod.Post);
    await client.endTestRun(3);
    expect(invokeSpy).toHaveBeenLastCalledWith({}, 'test-runs/3', Controllers.Telemetry, HttpMethod.Put);
    await client.addEnhancedTarget({ userId: 7, expiresAt: 'x' });
    expect(invokeSpy).toHaveBeenLastCalledWith({ userId: 7, expiresAt: 'x' }, 'enhanced-targets', Controllers.Telemetry, HttpMethod.Post);
    await client.removeEnhancedTarget(4);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'enhanced-targets/4', Controllers.Telemetry, HttpMethod.Delete);
  });
});

describe('PrivacyClient (api/privacy, KNG-34 link 6)', () => {
  const client = PrivacyClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => invokeSpy.mockRestore());

  it('lists, creates, previews, executes and cancels requests', async () => {
    await client.getRequests('Pending');
    expect(invokeSpy).toHaveBeenLastCalledWith({ status: 'Pending' }, 'deletion-requests', Controllers.Privacy, HttpMethod.Get);
    await client.getRequests();
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'deletion-requests', Controllers.Privacy, HttpMethod.Get);
    await client.createRequest(7, '');
    expect(invokeSpy).toHaveBeenLastCalledWith({ userId: 7, note: undefined }, 'deletion-requests', Controllers.Privacy, HttpMethod.Post);
    await client.execute(3, true);
    expect(invokeSpy).toHaveBeenLastCalledWith({}, 'deletion-requests/3/execute?dryRun=true', Controllers.Privacy, HttpMethod.Post);
    await client.execute(3, false);
    expect(invokeSpy).toHaveBeenLastCalledWith({}, 'deletion-requests/3/execute', Controllers.Privacy, HttpMethod.Post);
    await client.cancel(3);
    expect(invokeSpy).toHaveBeenLastCalledWith({}, 'deletion-requests/3/cancel', Controllers.Privacy, HttpMethod.Post);
  });
});

describe('WorldAnalyticsClient (api/world-analytics, KNG-34 link 7)', () => {
  const client = WorldAnalyticsClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => invokeSpy.mockRestore());

  it('reads worlds, heatmaps, funnels and domains with only the parameters that are set', async () => {
    await client.getWorlds({});
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'heatmap/worlds', Controllers.WorldAnalytics, HttpMethod.Get);
    await client.getHeatmap('world', { from: '2026-10-01', to: '' }, 64);
    expect(invokeSpy).toHaveBeenLastCalledWith({ world: 'world', from: '2026-10-01', cellSize: 64 }, 'heatmap', Controllers.WorldAnalytics, HttpMethod.Get);
    await client.getMenuFunnels({ to: '2026-10-03' }, 'profile.main');
    expect(invokeSpy).toHaveBeenLastCalledWith({ to: '2026-10-03', menuKey: 'profile.main' }, 'menu-funnels', Controllers.WorldAnalytics, HttpMethod.Get);
    await client.getDomains({}, 'discover');
    expect(invokeSpy).toHaveBeenLastCalledWith({ kind: 'discover' }, 'domains', Controllers.WorldAnalytics, HttpMethod.Get);
    expect(Controllers.WorldAnalytics).toBe('world-analytics');
  });
});
