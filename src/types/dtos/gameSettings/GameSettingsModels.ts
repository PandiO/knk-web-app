export type LocationReferenceSourceType = 'Location' | 'Town' | 'District' | 'Structure';

export type JoinSpawnMode = 'WorldSpawn' | 'CustomReference';

/**
 * JoinSpawn = respawn where the player would join ("synced" with the join spawn, KNG-52). WorldSpawn is
 * forced (beds and anchors ignored); ServerDefault = not redirected: bed / anchor, else the world spawn
 * (what staff and owners get, round 4).
 */
export type RespawnMode = 'WorldSpawn' | 'ConfiguredReference' | 'NearestTown' | 'JoinSpawn' | 'ServerDefault';

export type WeatherMode = 'Normal' | 'Constant' | 'Blocked' | 'Weighted';

export type WeatherType = 'CLEAR' | 'RAIN' | 'THUNDER';

export interface LocationSnapshotDto {
  locationId?: number | null;
  name?: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  world: string;
}

export interface LocationReferenceDto {
  sourceType: LocationReferenceSourceType;
  sourceId: number;
  displayLabel: string;
  location?: LocationSnapshotDto | null;
}

export interface RespawnPolicyDto {
  mode: RespawnMode;
  locationReference?: LocationReferenceDto | null;
  maxNearestTownDistance?: number | null;
  useWorldSpawnFallback: boolean;
}

export interface WorldWeatherSettingsDto {
  mode: WeatherMode;
  forcedWeather?: WeatherType | null;
  blockedWeatherTypes: WeatherType[];
  clearWeight: number;
  rainWeight: number;
  thunderWeight: number;
}

export interface WorldGameSettingsDto {
  worldName: string;
  worldFolderName?: string | null;
  defaultGameMode: string;
  lockTime: boolean;
  lockedTime: number;
  weather: WorldWeatherSettingsDto;
  worldSpawnReference?: LocationReferenceDto | null;
  respawnPolicy: RespawnPolicyDto;
}

export interface MinecraftWorldRuntimeDto {
  worldName: string;
  folderName: string;
  environment: string;
  loaded: boolean;
  playerCount: number;
  isPrimary: boolean;
}

/**
 * One permission group's overrides (KNG-52). null = no override: the player's next group, else the
 * global/world setting. A blank joinAnnouncement/leaveAnnouncement means "no join/leave broadcast" for
 * the group. Messages take {player}, {group} and {title} (alias {titlename}).
 */
export interface PermissionGroupGameSettingsDto {
  permissionGroupId: number;
  /** Read-only, filled in by the API. */
  groupName?: string | null;
  /** Read-only: 1 = considered first (hierarchy, then weight). */
  precedence?: number;
  joinAnnouncement?: string | null;
  /** null = not overridden; "" = the group's members leave silently. */
  leaveAnnouncement?: string | null;
  joinSpawnReference?: LocationReferenceDto | null;
  /**
   * True: the group's members join where they logged out (no join teleport, like owners); /spawn still
   * takes them to the server spawn. joinSpawnReference is then null (round 4).
   */
  joinAtLastLocation?: boolean | null;
  respawnPolicy?: RespawnPolicyDto | null;
  /** The hub's outage action for this group's members; null = not set (hub DESIGN §13). */
  outageAction?: HubOutageAction | null;
  /** Outage delay in seconds for this group's members; 0 = immediately; null = not set. */
  outageDelaySeconds?: number | null;
}

/** What happens to online players when the API is lost (hub DESIGN §1, §2). */
export type HubOutageAction = 'None' | 'SendToHub' | 'Kick' | 'SendToWorldSpawn';

/** The hub's rules (§13), applied inside the selected hub's region only. */
export interface HubRulesDto {
  damagePlayers: boolean;
  damageEntities: boolean;
  takeDamage: boolean;
  buildBreak: boolean;
  dropPickup: boolean;
  useDoors: boolean;
  useNpcs: boolean;
  useStorage: boolean;
  useItemFramesPaintings: boolean;
  healAmount: number;
  healIntervalTicks: number;
  feedAmount: number;
  feedIntervalTicks: number;
  saturationAmount: number;
  saturationIntervalTicks: number;
}

/** The hub (hub DESIGN §16 Phase 4). No domainId = no hub: players join as before. */
export interface HubSettingsDto {
  domainId?: number | null;
  /** Read-only, filled in by the API. */
  domainName?: string | null;
  domainType?: string | null;
  worldName?: string | null;
  wgRegionId?: string | null;
  spawnReference?: LocationReferenceDto | null;
  outageAction: HubOutageAction;
  /** 0 = "Uit": immediately. */
  outageDelaySeconds: number;
  rules: HubRulesDto;
  /** WorldGuard region ids in the hub's world: walking in takes the player into the game (decision 2026-10-12). */
  portalRegionIds?: string[];
}

/** A hub-eligible domain (decision 4). */
export interface HubDomainDto {
  id: number;
  name: string;
  domainType: string;
  worldName?: string | null;
  wgRegionId?: string | null;
  isHub: boolean;
  selected: boolean;
}

export interface GameSettingsDto {
  id: string;
  settingsVersion: string;
  joinAnnouncement: string;
  leaveAnnouncement: string;
  joinSpawnMode: JoinSpawnMode;
  joinSpawnReference?: LocationReferenceDto | null;
  defaultRespawnPolicy?: RespawnPolicyDto | null;
  worldSettings: WorldGameSettingsDto[];
  runtimeWorlds: MinecraftWorldRuntimeDto[];
  runtimeWorldsLastUpdatedAt?: string | null;
  /** Server-list MOTD (two lines, & codes, {online}/{max}); null = server.properties. */
  motd?: string | null;
  groupOverrides?: PermissionGroupGameSettingsDto[];
  hub?: HubSettingsDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameSettingsUpdateDto {
  settingsVersion: string;
  joinAnnouncement: string;
  leaveAnnouncement: string;
  joinSpawnMode: JoinSpawnMode;
  joinSpawnReference?: LocationReferenceDto | null;
  defaultRespawnPolicy?: RespawnPolicyDto | null;
  worldSettings: WorldGameSettingsDto[];
  /** null/undefined keeps the stored MOTD; '' clears it. */
  motd?: string | null;
  /** null/undefined keeps the stored overrides; a list (also empty) replaces them. */
  groupOverrides?: PermissionGroupGameSettingsDto[] | null;
  /** null/undefined keeps the stored hub settings. */
  hub?: HubSettingsDto | null;
}

export interface GameSettingsRuntimeWorldsUpdateDto {
  runtimeWorlds: MinecraftWorldRuntimeDto[];
}
