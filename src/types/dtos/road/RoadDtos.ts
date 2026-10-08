// Road navigation (knk-web-api Dtos/RoadDtos.cs, docs/specs/navigation/DESIGN.md §3,
// IMPLEMENTATION_PLAN.md Phase 5). Property names are the API's [JsonPropertyName]s (camelCase);
// enums travel by name; edge flags are a string array.

/**
 * knk-web-api StaffPermissions.RoadManage: every road write (profiles, edges, nodes) needs it -
 * or the plugin's service key. Reads are anonymous.
 */
export const ROAD_ADMIN_NODE = 'knk.admin.road';

export const ROAD_CLASSES = ['Main', 'Road', 'Path'] as const;
export type RoadClass = typeof ROAD_CLASSES[number];

export const ROAD_MATERIAL_ROLES = ['Surface', 'Edge', 'Accent', 'Overlay'] as const;
export type RoadMaterialRole = typeof ROAD_MATERIAL_ROLES[number];

export const ROAD_EDGE_FLAGS = ['Oneway', 'NoGps', 'Closed'] as const;
export type RoadEdgeFlag = typeof ROAD_EDGE_FLAGS[number];

export type RoadNodeKind = 'Junction' | 'Endpoint' | 'Boundary' | 'Anchor';
export type RoadNodeSource = 'Detected' | 'Manual';
export type RoadEdgeSource = 'Detected' | 'Recorded' | 'Stitch';
export type RoadEdgeStatus = 'Ok' | 'Stale';
export type RoadStreetSource = 'Inferred' | 'Manual' | 'None';

/** One material of a profile. Shares and samples come from surveys and are read-only here. */
export interface RoadMaterialDto {
  /** A Bukkit Material name, e.g. COBBLESTONE (the API checks ^[A-Z0-9_]+$). */
  material: string;
  role: RoadMaterialRole;
  /** True for materials that also build houses/kerbs (DESIGN §5.1). */
  ambiguous: boolean;
  centreShare: number;
  edgeShare: number;
  samples: number;
}

export interface RoadProfileDto {
  id: number;
  name: string;
  roadClass: RoadClass;
  costMultiplier: number;
  materials: RoadMaterialDto[];
  widthMin: number;
  widthMax: number;
  sampleCount: number;
  enabled: boolean;
  /** Town domain ids the profile is limited to; null = everywhere (plan D8). */
  scopeTownIds: number[] | null;
  /** Accumulated survey statistics - opaque, never shown or edited (plan D5, Phase 2e decision 3). */
  stats?: unknown;
  createdAt: string;
  updatedAt: string;
}

/** POST/PUT body of a profile. `stats: null` keeps the stored statistics (an admin edit). */
export interface RoadProfileUpsertDto {
  name: string;
  roadClass: RoadClass;
  costMultiplier: number;
  materials: RoadMaterialDto[];
  widthMin: number;
  widthMax: number;
  sampleCount: number;
  enabled: boolean;
  scopeTownIds: number[] | null;
  stats: null;
}

export interface RoadTileDto {
  id: number;
  world: string;
  tileX: number;
  tileZ: number;
  /** The ETag of the tile's graph download; +1 per build. */
  version: number;
  builtAt: string | null;
  builderVersion: number;
  dirty: boolean;
  cellCount: number;
  nodeCount: number;
  edgeCount: number;
  levelCount: number;
  warnings: string[];
}

export interface RoadNodeDto {
  id: number;
  world: string;
  x: number;
  y: number;
  z: number;
  tileId: number;
  kind: RoadNodeKind;
  source: RoadNodeSource;
  name: string | null;
  componentId: number;
  locked: boolean;
}

export interface RoadEdgeDto {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  tileId: number;
  world: string;
  /** [[x,y,z],...] from the From node to the To node. */
  geometry: number[][];
  length: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  avgWidth: number;
  profileId: number | null;
  streetId: number | null;
  streetSource: RoadStreetSource;
  costMultiplier: number;
  flags: string[];
  gateDoorIds: number[];
  domainIds: number[];
  regionIds: string[];
  source: RoadEdgeSource;
  status: RoadEdgeStatus;
}

export interface RoadTileGraphDto {
  tile: RoadTileDto;
  nodes: RoadNodeDto[];
  edges: RoadEdgeDto[];
}

export interface RoadStreetRefDto {
  id: number;
  name: string;
}

export interface RoadComponentDto {
  id: number;
  nodeCount: number;
}

/** GET api/road-network/meta?world=: profiles, the streets edges are labelled with, components. */
export interface RoadNetworkMetaDto {
  profiles: RoadProfileDto[];
  streets: RoadStreetRefDto[];
  components: RoadComponentDto[];
}

/**
 * Body of POST api/road-edges/search. The API's PagedQueryDto binds "pageNumber" (not the shared
 * web-app PagedQueryDto's "page"); filter values are strings ("true" for the booleans).
 */
export interface RoadEdgeSearchQuery {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: 'id' | 'length' | 'streetId' | 'tileId';
  sortDescending?: boolean;
  filters?: {
    world?: string;
    tileId?: string;
    streetId?: string;
    unlabelled?: 'true';
    stale?: 'true';
  };
}

/** The API's PagedResultDto: `pageNumber`, not the shared PagedResultDto's `page`. */
export interface RoadPagedResultDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

/** PUT api/road-edges/{id}: fields left out are left as they are. */
export interface RoadEdgeUpdateDto {
  /** Sets the street (streetSource becomes Manual). */
  streetId?: number;
  /** Removes the street label (streetSource becomes None). */
  clearStreet?: boolean;
  /** With a street change: also label the edges that continue this one along the road. */
  propagate?: boolean;
  profileId?: number;
  clearProfile?: boolean;
  costMultiplier?: number;
  /** Replaces the flag set; [] clears it. */
  flags?: string[];
}

export interface RoadEdgeUpdateResultDto {
  edge: RoadEdgeDto;
  /** Every edge the call changed, the edge itself first, then the propagated ones. */
  changedEdgeIds: number[];
}

/** PUT api/road-nodes/{id}: editing locks the node unless `locked: false` is sent. */
export interface RoadNodeUpdateDto {
  name?: string;
  clearName?: boolean;
  kind?: RoadNodeKind;
  locked?: boolean;
}

/** GET api/Streets/{id}/road: the street's labelled edges and the nodes they use. */
export interface StreetRoadDto {
  streetId: number;
  name: string;
  edgeCount: number;
  totalLength: number;
  edges: RoadEdgeDto[];
  nodes: RoadNodeDto[];
}

/** Tile coordinate of a block coordinate (RoadTile.Size = 512). */
export const roadTileCoordinate = (blockCoordinate: number): number => Math.floor(blockCoordinate / 512);

export const roadClassLabel = (roadClass: string): string => roadClass;

/** "Oneway, NoGps" - or "-" for an edge without flags. */
export const formatRoadFlags = (flags: string[] | null | undefined): string =>
  flags && flags.length > 0 ? flags.join(', ') : '-';
