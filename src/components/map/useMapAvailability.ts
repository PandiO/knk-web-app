import { useEffect, useState } from 'react';
import { mapClient } from '../../apiClients/mapClient';
import type { MapConfigDto } from '../../types/dtos/map/MapDtos';

/**
 * Whether the overview map is on (O27): the API's `GET api/Map/config` answers 200 with `enabled: true`. A 404 (the
 * API's `Map:Enabled` is off), any other failure or `enabled: false` mean "off": no nav entry, no landing-page link,
 * `/map` says "not available". One request per page load, shared by the bar, the landing page and the map page.
 */
export type MapAvailability =
  | { status: 'checking' }
  | { status: 'on'; config: MapConfigDto }
  | { status: 'off' };

let cached: Promise<MapAvailability> | null = null;

export function loadMapAvailability(): Promise<MapAvailability> {
  if (!cached) {
    // Promise.resolve first: a client that throws at once still means "off", never an unhandled error.
    cached = Promise.resolve().then(() => mapClient.getConfig()).then(
      config => (config && config.enabled ? { status: 'on', config } as MapAvailability : { status: 'off' } as MapAvailability),
      () => ({ status: 'off' } as MapAvailability),
    );
  }
  return cached;
}

/** Tests only: forget the shared answer. */
export function resetMapAvailability(): void {
  cached = null;
}

export function useMapAvailability(): MapAvailability {
  const [availability, setAvailability] = useState<MapAvailability>({ status: 'checking' });
  useEffect(() => {
    let cancelled = false;
    loadMapAvailability().then(result => {
      if (!cancelled) setAvailability(result);
    });
    return () => { cancelled = true; };
  }, []);
  return availability;
}
