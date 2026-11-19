/**
 * The BlueMap bridge protocol (OVERVIEW_MAP_DESIGN § 5 rule 14, O14, O26; PandiO/knk-workspace#737).
 *
 * The `/map` page and the bridge script inside BlueMap's iframe (`public/bluemap-bridge/bridge.js`) talk only through
 * these versioned postMessage envelopes `{ v, type, payload }`. The bridge only draws and reports clicks; it never
 * knows about panels or actions (rule 13). Version 1 is frozen: a later feature (the siege tactical map, #613) adds
 * new message types or a new version, it never changes the meaning of a v1 message. Both sides accept messages only
 * from the page's own origin and the expected window (A10).
 *
 * Keep this file and the constants at the top of `bridge.js` in step.
 */

export const BRIDGE_PROTOCOL_VERSION = 1;

/** The kinds of things the map draws and reports clicks for. `arena` pins come with live players (#738/#739). */
export type MapEntityKind = 'town' | 'district' | 'structure' | 'arena';

/** A pin with its always-visible label (O04). `maxDistance` null: the label shows at every zoom (O19). */
export interface BridgePin {
  kind: MapEntityKind;
  id: number;
  label: string;
  /** A second label line, for example `Structure, Gate` (O06). */
  sublabel?: string | null;
  world: string;
  x: number;
  /** Null: the bridge picks the terrain height (a centroid pin). */
  y: number | null;
  z: number;
  maxDistance: number | null;
}

/** One outline of a region, already shifted to the block centres (+0.5). */
export interface BridgeOutline {
  points: [number, number][];
  minY: number;
  maxY: number;
}

/** A region the bridge can flash or show: one domain's outlines. `key` is `<kind>:<id>`. */
export interface BridgeRegion {
  key: string;
  kind: MapEntityKind;
  id: number;
  /** Shown on the region while it is visible (O05: the display name, never the region id). */
  label: string;
  world: string;
  outlines: BridgeOutline[];
}

export interface BridgeMarkers {
  version: string;
  pins: BridgePin[];
  regions: BridgeRegion[];
}

/**
 * One styled run of a player's name label (#739, O23): the page has already turned the `&` codes into CSS, so the
 * bridge only draws. `color` is `#RRGGBB` or null (the bridge ignores any other value).
 */
export interface BridgeTextPart {
  text: string;
  color: string | null;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/** The tags a player label can carry (O07): AFK, staff or owner mode (or another hidden mode), a minigame. */
export type BridgePlayerTagKind = 'afk' | 'staff' | 'owner' | 'hidden' | 'minigame';

export interface BridgePlayerTag {
  kind: BridgePlayerTagKind;
  text: string;
}

/**
 * A live player (phase 4b, #739). `label` is the plain text of the name label; `parts` and `tags` are optional
 * additions of #739 (an older bridge draws `label` only, a newer one prefers `parts`), so the v1 message keeps its
 * meaning (O14).
 */
export interface BridgePlayer {
  uuid: string;
  label: string;
  world: string;
  x: number;
  y: number;
  z: number;
  parts?: BridgeTextPart[];
  tags?: BridgePlayerTag[];
}

export interface PageToMapPayloads {
  setMarkers: BridgeMarkers;
  /** Flashes a region `count` times, `durationMs` on and off each (rule 5). */
  flashRegion: { key: string; count: number; durationMs: number };
  /** Shows these regions as one named group, replacing what that group showed before. */
  showRegions: { group: string; keys: string[] };
  hideRegions: { group: string };
  setPlayers: { players: BridgePlayer[] };
  /** Moves the camera; `distance` optional. */
  focus: { world: string; x: number; y?: number | null; z: number; distance?: number | null };
}

export interface MapToPagePayloads {
  /** The bridge is loaded and listening; sent again when BlueMap switches maps. */
  ready: { protocol: number; mapId: string | null };
  markerClicked: { kind: MapEntityKind; id: number };
  playerClicked: { uuid: string };
  cameraChanged: { mapId: string | null; x: number; y: number; z: number; distance: number };
  /**
   * Escape was pressed while the keyboard focus was inside the map's iframe (#757). Added to v1 as a new type (O14):
   * an older bridge never sends it, an older page ignores it. The payload is empty.
   */
  escapePressed: Record<string, never>;
}

export type PageToMapType = keyof PageToMapPayloads;
export type MapToPageType = keyof MapToPagePayloads;

export type BridgeEnvelope<K extends string, P> = { v: typeof BRIDGE_PROTOCOL_VERSION; type: K; payload: P };

export type PageToMapMessage = { [K in PageToMapType]: BridgeEnvelope<K, PageToMapPayloads[K]> }[PageToMapType];
export type MapToPageMessage = { [K in MapToPageType]: BridgeEnvelope<K, MapToPagePayloads[K]> }[MapToPageType];

export function pageMessage<K extends PageToMapType>(type: K, payload: PageToMapPayloads[K]): PageToMapMessage {
  return { v: BRIDGE_PROTOCOL_VERSION, type, payload } as PageToMapMessage;
}

const MAP_TO_PAGE_TYPES: readonly MapToPageType[] = [
  'ready', 'markerClicked', 'playerClicked', 'cameraChanged', 'escapePressed',
];
const ENTITY_KINDS: readonly MapEntityKind[] = ['town', 'district', 'structure', 'arena'];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Reads a message from the bridge, or null when it must be ignored: another origin, another window than the map's
 * iframe, another protocol version, an unknown type or a malformed payload (A10).
 */
export function parseBridgeMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  expectedSource: MessageEventSource | null | undefined,
  expectedOrigin: string,
): MapToPageMessage | null {
  if (event.origin !== expectedOrigin) return null;
  if (!expectedSource || event.source !== expectedSource) return null;
  const data = event.data;
  if (!isObject(data) || data.v !== BRIDGE_PROTOCOL_VERSION) return null;
  if (typeof data.type !== 'string' || !MAP_TO_PAGE_TYPES.includes(data.type as MapToPageType)) return null;
  const payload = data.payload;
  if (!isObject(payload)) return null;
  switch (data.type as MapToPageType) {
    case 'markerClicked':
      if (!ENTITY_KINDS.includes(payload.kind as MapEntityKind) || !Number.isInteger(payload.id)) return null;
      break;
    case 'playerClicked':
      if (typeof payload.uuid !== 'string') return null;
      break;
    case 'ready':
      if (typeof payload.protocol !== 'number') return null;
      break;
    default:
      break;
  }
  return data as unknown as MapToPageMessage;
}

/** The origin of the BlueMap URL, resolved against the page (same origin under `/bluemap/` by default, O26). */
export function originOf(url: string, base: string = window.location.href): string {
  return new URL(url, base).origin;
}

export const regionKey = (kind: MapEntityKind, id: number): string => `${kind}:${id}`;
