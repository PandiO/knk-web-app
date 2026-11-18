/**
 * The public overview map API (knk-web-api `Controllers/MapController.cs`, `Dtos/MapDtos.cs`;
 * PandiO/knk-workspace#736, OVERVIEW_MAP_DESIGN § 6.2.8). Every route is anonymous and answers 404 while the API's
 * `Map:Enabled` is off. The panel DTOs are the O32 allow-list: nothing beyond these fields reaches the page.
 */

/** `GET api/Map/config`. */
export interface MapConfigDto {
  enabled: boolean;
  /** Changes whenever the marker set changes; the page reloads the markers when it differs (spec § 5 rule 2). */
  markerVersion: string;
  /** BlueMap camera distance (blocks) up to which a label shows; null = every zoom (O19). */
  labels: MapLabelDistancesDto;
  flash: MapFlashDto;
  livePlayers: MapLivePlayersConfigDto;
  gateCommands: MapPartConfigDto;
}

export interface MapLabelDistancesDto {
  town: number | null;
  district: number | null;
  structure: number | null;
  arena: number | null;
}

export interface MapFlashDto {
  count: number;
  durationMs: number;
}

export interface MapPartConfigDto {
  enabled: boolean;
}

export interface MapLivePlayersConfigDto extends MapPartConfigDto {
  pollIntervalMs: number;
}

/** Where a pin sits (O18): the spawn location, otherwise the 2D centroid of the main outline (`y: null`). */
export interface MapPinDto {
  world: string;
  x: number;
  y: number | null;
  z: number;
  source: 'location' | 'centroid' | string;
}

/** One outline: `[[x, z], ...]` in block coordinates, inclusive (draw through the block centres, +0.5). */
export interface MapOutlineDto {
  world: string;
  points: [number, number][];
  minY: number;
  maxY: number;
}

export interface MapTownMarkerDto {
  id: number;
  name: string;
  pin: MapPinDto;
  outlines: MapOutlineDto[];
}

export interface MapDistrictMarkerDto {
  id: number;
  townId: number;
  name: string;
  pin: MapPinDto;
  outlines: MapOutlineDto[];
}

export interface MapStructureMarkerDto {
  id: number;
  districtId: number;
  townId: number;
  name: string;
  type: string;
  subtype: string | null;
  /** For example `Structure, Gate`. */
  typeLabel: string;
  pin: MapPinDto;
  outlines: MapOutlineDto[];
}

/** `GET api/Map/markers`. */
export interface MapMarkersDto {
  version: string;
  towns: MapTownMarkerDto[];
  districts: MapDistrictMarkerDto[];
  structures: MapStructureMarkerDto[];
}

/** `GET api/Map/towns/{id}` (O32: name, description, number of districts). */
export interface MapTownPanelDto {
  id: number;
  name: string;
  description: string;
  districtCount: number;
}

/** `GET api/Map/districts/{id}` (O32: name, description, town). */
export interface MapDistrictPanelDto {
  id: number;
  name: string;
  description: string;
  townName: string;
}

/** The effective door state, lower case. */
export type MapGateDoorOpenState = 'open' | 'closed' | 'opening' | 'closing' | 'jammed';

export interface MapGateDoorPanelDto {
  name: string;
  openState: MapGateDoorOpenState | string;
  isDestroyed: boolean;
  healthCurrent: number;
  healthMax: number;
}

export interface MapGatePanelDto {
  underSiege: boolean;
  doors: MapGateDoorPanelDto[];
}

/** `GET api/Map/structures/{id}` (O32); `gate` only for a gate structure. */
export interface MapStructurePanelDto {
  id: number;
  name: string;
  description: string;
  type: string;
  subtype: string | null;
  districtName: string;
  townName: string;
  streetName: string;
  houseNumber: number;
  gate: MapGatePanelDto | null;
}

/**
 * `GET api/Map/players` (PandiO/knk-workspace#738, OVERVIEW_MAP_DESIGN § 6.2.9): the caller's audience snapshot. A
 * valid JWT selects the logged-in or the "may see hidden" snapshot; anonymous callers get the public one. 404 while
 * `Map:Enabled` or `Map:LivePlayers:Enabled` is off. Never cached (`no-store`).
 */
export interface MapPlayersDto {
  /** How often the page should poll, in milliseconds. */
  intervalMs: number;
  players: MapPlayerDto[];
  /** One pin per running minigame match (O13, O24, O31), the same for every audience. */
  arenas: MapArenaDto[];
}

export interface MapPlayerDto {
  /** The Minecraft UUID (lower case): the head is drawn from it. */
  uuid: string;
  world: string;
  x: number;
  y: number;
  z: number;
  /** Facing in whole degrees, Minecraft convention. */
  yaw: number;
  label: MapPlayerLabelDto;
  afk: boolean;
  /** `staff`, `owner` or `hidden` (an unknown mode); only in the "may see hidden" snapshot. */
  mode: 'staff' | 'owner' | 'hidden' | string | null;
  /** The minigame tag (`Siege`) of a player in a running match; only in the "may see hidden" snapshot. */
  minigame: string | null;
}

/**
 * The in-game chat line's parts (O23, knk-plugin `ChatLineFormat`): `[rankTag]-{braced}- name`. Colours are Minecraft
 * `&` codes as the groups store them (a colour, optionally formats, or hex `&x&r&r&g&g&b&b`).
 */
export interface MapPlayerLabelDto {
  /** `OWNER`, `STAFF` or null. */
  rankTag: string | null;
  /** The text inside `-{ }-`, or null to leave the segment out. */
  braced: string | null;
  bracedBold: boolean;
  name: string;
  /** Colour codes of the brackets (`[ ]`, `-{ }-`). */
  bracketColor: string;
  /** Colour codes of the rank tag, the braced text and the name. */
  textColor: string;
}

export interface MapArenaDto {
  /** The minigame tag, for example `Siege`. */
  minigame: string;
  /** For example `[Siege] 12 players`. */
  label: string;
  playerCount: number;
  pin: MapPinDto;
}
