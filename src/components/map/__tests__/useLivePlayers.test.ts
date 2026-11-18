import { act, renderHook } from '@testing-library/react';
import { PLAYER_POLL_FAILURES_BEFORE_CLEAR, useLivePlayers } from '../useLivePlayers';

// PandiO/knk-workspace#739, O21, O27: poll api/Map/players at the interval, only while the flag is on.
jest.mock('../../../apiClients/mapClient', () => ({ mapClient: { getPlayers: jest.fn() } }));
// eslint-disable-next-line import/first
import { mapClient } from '../../../apiClients/mapClient';

const getPlayers = mapClient.getPlayers as jest.Mock;
const snapshot = (name: string, intervalMs = 2000) => ({
  intervalMs,
  players: [{
    uuid: 'u1', world: 'world', x: 1, y: 64, z: 2, yaw: 0, afk: false, mode: null, minigame: null,
    label: { rankTag: null, braced: null, bracedBold: false, name, bracketColor: '&2', textColor: '&a' },
  }],
  arenas: [],
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  jest.useFakeTimers();
  getPlayers.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

it('makes no request and returns null while the flag is off', async () => {
  const { result } = renderHook(() => useLivePlayers({ enabled: false, pollIntervalMs: 2000 }));
  await flush();
  await act(async () => { jest.advanceTimersByTime(10_000); });
  expect(getPlayers).not.toHaveBeenCalled();
  expect(result.current).toBeNull();
});

it('polls right away and then every interval, one request at a time (A11)', async () => {
  getPlayers.mockResolvedValueOnce(snapshot('Alex')).mockResolvedValueOnce(snapshot('Alex moved'));
  const { result } = renderHook(() => useLivePlayers({ enabled: true, pollIntervalMs: 2000 }));
  await flush();
  expect(getPlayers).toHaveBeenCalledTimes(1);
  expect(result.current?.players[0].label.name).toBe('Alex');

  await act(async () => { jest.advanceTimersByTime(1999); });
  expect(getPlayers).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); });
  await flush();
  expect(getPlayers).toHaveBeenCalledTimes(2);
  expect(result.current?.players[0].label.name).toBe('Alex moved');
});

it("follows the API's intervalMs, clamped to at least 500 ms", async () => {
  getPlayers.mockResolvedValue(snapshot('Alex', 100));
  renderHook(() => useLivePlayers({ enabled: true, pollIntervalMs: 2000 }));
  await flush();
  await act(async () => { jest.advanceTimersByTime(499); });
  expect(getPlayers).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(getPlayers).toHaveBeenCalledTimes(2);
});

it('keeps the last players through a failed poll and clears them after three in a row', async () => {
  getPlayers.mockResolvedValueOnce(snapshot('Alex')).mockRejectedValue(new Error('network'));
  const { result } = renderHook(() => useLivePlayers({ enabled: true, pollIntervalMs: 2000 }));
  await flush();
  for (let failure = 1; failure < PLAYER_POLL_FAILURES_BEFORE_CLEAR; failure += 1) {
    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();
    expect(result.current?.players).toHaveLength(1);
  }
  await act(async () => { jest.advanceTimersByTime(2000); });
  await flush();
  expect(result.current).toBeNull();
});

it('skips polls while the tab is hidden', async () => {
  getPlayers.mockResolvedValue(snapshot('Alex'));
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  renderHook(() => useLivePlayers({ enabled: true, pollIntervalMs: 2000 }));
  await act(async () => { jest.advanceTimersByTime(6000); });
  expect(getPlayers).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(getPlayers).toHaveBeenCalledTimes(1);
  hidden.mockRestore();
});

it('stops polling when unmounted', async () => {
  getPlayers.mockResolvedValue(snapshot('Alex'));
  const { unmount } = renderHook(() => useLivePlayers({ enabled: true, pollIntervalMs: 2000 }));
  await flush();
  unmount();
  await act(async () => { jest.advanceTimersByTime(10_000); });
  expect(getPlayers).toHaveBeenCalledTimes(1);
});
