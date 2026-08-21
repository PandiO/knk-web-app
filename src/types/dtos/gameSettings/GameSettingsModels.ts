export type LocationReferenceSourceType = 'Location' | 'Town' | 'District' | 'Structure';

export type JoinSpawnMode = 'WorldSpawn' | 'CustomReference';

export type RespawnMode = 'WorldSpawn' | 'ConfiguredReference' | 'NearestTown';

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
}

export interface GameSettingsRuntimeWorldsUpdateDto {
  runtimeWorlds: MinecraftWorldRuntimeDto[];
}
