import { useEffect, useState } from 'react';
import { mapClient } from '../../apiClients/mapClient';
import type { MapLivePlayersConfigDto, MapPlayersDto } from '../../types/dtos/map/MapDtos';

/** The poll interval is clamped to this range, whatever the API says. */
export const MIN_PLAYER_POLL_MS = 500;
export const MAX_PLAYER_POLL_MS = 60_000;
/** After this many failed polls in a row the players are cleared (the API drops a player after three missed intervals). */
export const PLAYER_POLL_FAILURES_BEFORE_CLEAR = 3;

const clampInterval = (ms: number | null | undefined, fallback: number): number => {
  const value = typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : fallback;
  return Math.min(MAX_PLAYER_POLL_MS, Math.max(MIN_PLAYER_POLL_MS, value));
};

/**
 * Polls `GET api/Map/players` (O21; PandiO/knk-workspace#739) while `config.livePlayers.enabled` is on: right away,
 * then every `intervalMs` of the last answer (else `pollIntervalMs`), one request at a time. While the flag is off it
 * makes no request and returns null (O27). A hidden browser tab skips its polls. The JWT, when logged in, goes with
 * every request (`serviceCall`) and selects the viewer's audience.
 */
export function useLivePlayers(config: MapLivePlayersConfigDto): MapPlayersDto | null {
  const [snapshot, setSnapshot] = useState<MapPlayersDto | null>(null);
  const { enabled, pollIntervalMs } = config;

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      return undefined;
    }
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;
    let interval = clampInterval(pollIntervalMs, 2000);

    const schedule = () => {
      if (!cancelled) timer = window.setTimeout(poll, interval);
    };
    const poll = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      mapClient.getPlayers().then(
        result => {
          if (cancelled) return;
          failures = 0;
          interval = clampInterval(result?.intervalMs, interval);
          setSnapshot({
            intervalMs: result?.intervalMs ?? interval,
            players: Array.isArray(result?.players) ? result.players : [],
            arenas: Array.isArray(result?.arenas) ? result.arenas : [],
          });
          schedule();
        },
        () => {
          if (cancelled) return;
          failures += 1;
          if (failures >= PLAYER_POLL_FAILURES_BEFORE_CLEAR) setSnapshot(null);
          schedule();
        },
      );
    };
    poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [enabled, pollIntervalMs]);

  return snapshot;
}
