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
}

export interface GameSettingsRuntimeWorldsUpdateDto {
  runtimeWorlds: MinecraftWorldRuntimeDto[];
}
