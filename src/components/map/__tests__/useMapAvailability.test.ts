import { loadMapAvailability, resetMapAvailability } from '../useMapAvailability';

// PandiO/knk-workspace#737, O27: the map is on only when api/Map/config answers with enabled: true.
jest.mock('../../../apiClients/mapClient', () => ({ mapClient: { getConfig: jest.fn() } }));
// eslint-disable-next-line import/first
import { mapClient } from '../../../apiClients/mapClient';

const getConfig = mapClient.getConfig as jest.Mock;
const config = {
  enabled: true, markerVersion: 'abc', labels: { town: null, district: 1500, structure: 600, arena: 1500 },
  flash: { count: 3, durationMs: 400 }, livePlayers: { enabled: false, pollIntervalMs: 2000 }, gateCommands: { enabled: false },
};

beforeEach(() => {
  resetMapAvailability();
  getConfig.mockReset();
});

it('is on with the config when the API says enabled', async () => {
  getConfig.mockResolvedValue(config);
  await expect(loadMapAvailability()).resolves.toEqual({ status: 'on', config });
});

it('is off on a 404 (Map:Enabled off), on any other failure and on enabled: false', async () => {
  getConfig.mockRejectedValueOnce(Object.assign(new Error('nf'), { status: 404 }));
  await expect(loadMapAvailability()).resolves.toEqual({ status: 'off' });
  resetMapAvailability();
  getConfig.mockRejectedValueOnce(new Error('network'));
  await expect(loadMapAvailability()).resolves.toEqual({ status: 'off' });
  resetMapAvailability();
  getConfig.mockResolvedValueOnce({ ...config, enabled: false });
  await expect(loadMapAvailability()).resolves.toEqual({ status: 'off' });
});

it('asks the API once per page load', async () => {
  getConfig.mockResolvedValue(config);
  await loadMapAvailability();
  await loadMapAvailability();
  expect(getConfig).toHaveBeenCalledTimes(1);
});
