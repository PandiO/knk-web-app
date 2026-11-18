import { BRIDGE_PROTOCOL_VERSION, originOf, pageMessage, parseBridgeMessage, regionKey } from '../bridgeProtocol';

// PandiO/knk-workspace#737, A10: the page reads only versioned messages from the map's own iframe on its own origin.
describe('parseBridgeMessage', () => {
  const origin = 'https://knk.example';
  const frame = {} as Window;
  const event = (data: unknown, overrides: Partial<{ origin: string; source: unknown }> = {}) => ({
    origin, source: frame, data, ...overrides,
  }) as Pick<MessageEvent, 'origin' | 'source' | 'data'>;
  const click = { v: 1, type: 'markerClicked', payload: { kind: 'town', id: 7 } };

  it('accepts a v1 message from the map iframe on the expected origin', () => {
    expect(parseBridgeMessage(event(click), frame, origin)).toEqual(click);
  });

  it('ignores a message from another origin (A10)', () => {
    expect(parseBridgeMessage(event(click, { origin: 'https://evil.example' }), frame, origin)).toBeNull();
  });

  it('ignores a message from another window on the same origin', () => {
    expect(parseBridgeMessage(event(click, { source: {} }), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event(click), null, origin)).toBeNull();
  });

  it('ignores other protocol versions, unknown types and malformed payloads', () => {
    expect(parseBridgeMessage(event({ ...click, v: 2 }), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event({ ...click, type: 'openAdminPanel' }), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event({ v: 1, type: 'markerClicked', payload: { kind: 'user', id: 1 } }), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event({ v: 1, type: 'markerClicked', payload: { kind: 'town', id: '1' } }), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event({ v: 1, type: 'playerClicked', payload: {} }), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event('markerClicked'), frame, origin)).toBeNull();
    expect(parseBridgeMessage(event(null), frame, origin)).toBeNull();
  });

  it('accepts ready, playerClicked and cameraChanged', () => {
    const ready = { v: 1, type: 'ready', payload: { protocol: 1, mapId: 'world' } };
    const player = { v: 1, type: 'playerClicked', payload: { uuid: 'abc' } };
    const camera = { v: 1, type: 'cameraChanged', payload: { mapId: 'world', x: 1, y: 2, z: 3, distance: 400 } };
    expect(parseBridgeMessage(event(ready), frame, origin)).toEqual(ready);
    expect(parseBridgeMessage(event(player), frame, origin)).toEqual(player);
    expect(parseBridgeMessage(event(camera), frame, origin)).toEqual(camera);
  });
});

describe('protocol helpers', () => {
  it('wraps a page message in the v1 envelope', () => {
    expect(pageMessage('hideRegions', { group: 'g' })).toEqual({ v: BRIDGE_PROTOCOL_VERSION, type: 'hideRegions', payload: { group: 'g' } });
    expect(BRIDGE_PROTOCOL_VERSION).toBe(1);
  });

  it('resolves the BlueMap origin against the page (same origin under /bluemap/, O26)', () => {
    expect(originOf('/bluemap/', 'https://knk.example/map')).toBe('https://knk.example');
    expect(originOf('https://tiles.example/bluemap/', 'https://knk.example/map')).toBe('https://tiles.example');
  });

  it('builds region keys as kind:id', () => {
    expect(regionKey('district', 4)).toBe('district:4');
  });
});
