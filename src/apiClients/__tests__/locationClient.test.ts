import { locationClient } from '../locationClient';
import { Controllers, HttpMethod } from '../../utils';

// KNG-52 round 3: getAll() asked for GET api/Locations/GetAll, which the API doesn't have (only
// GET api/Locations). The 404 was swallowed by the Game Settings page, so its spawn point picker had
// no Locations and no Structures (structures only carry a locationId).

describe('LocationClient.getAll', () => {
  const originalFetch = global.fetch;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    logSpy.mockRestore();
  });

  it('requests GET api/Locations, without a GetAll segment', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => [{ id: 1, name: 'Spawn', x: 0, y: 64, z: 0, yaw: 0, pitch: 0, world: 'world' }],
    });
    global.fetch = fetchMock as any;

    const result = await locationClient.getAll();

    expect(result).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/${Controllers.Locations}$`));
    expect(init.method).toBe(HttpMethod.Get);
  });
});
