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
