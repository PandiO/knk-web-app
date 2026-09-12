import { MinecraftMaterialRefDto } from '../minecraftMaterialRef/MinecraftMaterialRefDto';
import { LocationDto } from '../locations/LocationModels';
import { GateDoorDto, GateDoorOpenState, HealthDisplayMode, GateInfoDisplayMode } from './GateDoorDto';

// Re-exported so existing imports of these shared enum-ish types from GateStructureDto keep
// working now that their canonical home is GateDoorDto (item 5 moved the fields they describe).
export type {
  GateType,
  GeometryDefinitionMode,
  MotionType,
  FaceDirection,
  HealthDisplayMode,
  GateInfoDisplayMode,
  TileEntityPolicy,
  GateDoorOpenState
} from './GateDoorDto';

/**
 * Item 5 (docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md) moved
 * every per-door field (geometry, animation, health, block snapshots, etc. - see GateDoorDto)
 * off this DTO onto the new GateDoorDto, embedded here as gateDoors. What's left is structure-
 * level identity, the guard/siege systems, and the structure-level cascading override fields
 * (decision 5.0-B).
 */
export interface GateStructureDto {
  id?: number;
  name: string;
  description?: string;
  createdAt?: Date;
  allowEntry?: boolean;
  allowExit?: boolean;
  wgRegionId?: string;
  locationId?: number | null;
  streetId: number;
  districtId: number;
  houseNumber: number;
  iconMaterialRefId?: number | null;

  guardSpawnLocationIds?: number[];
  guardSpawnLocations?: LocationDto[];
  guardCount?: number;
  guardNpcTemplateId?: number | null;

  isOverridable?: boolean;
  animateDuringSiege?: boolean;
  currentSiegeId?: number | null;
  isSiegeObjective?: boolean;

  // === Structure-level cascading overrides (decision 5.0-B) ===
  // Null/absent means "no override, each door uses its own value". Set/cleared via a dedicated
  // overrides endpoint, not this general read/write DTO.
  isActiveOverride?: boolean | null;
  canRespawnOverride?: boolean | null;
  isDestroyedOverride?: boolean | null;
  isInvincibleOverride?: boolean | null;
  openedStateOverride?: GateDoorOpenState | null;
  allowPassThroughOverride?: boolean | null;
  passThroughDurationSecondsOverride?: number | null;
  showHealthDisplayOverride?: boolean | null;
  healthDisplayModeOverride?: HealthDisplayMode | null;
  healthDisplayYOffsetOverride?: number | null;
  gateNameDisplayModeOverride?: GateInfoDisplayMode | null;
  statusDisplayModeOverride?: GateInfoDisplayMode | null;
  allowContinuousDamageOverride?: boolean | null;
  continuousDamageMultiplierOverride?: number | null;

  gateDoors?: GateDoorDto[];

  street?: GateStructureStreetNavDto;
  district?: GateStructureDistrictNavDto;
  iconMaterialRef?: MinecraftMaterialRefDto;
}

export interface GateStructureListDto {
  id?: number;
  name: string;
  description: string;
  wgRegionId: string;
  houseNumber: number;
  streetId: number;
  streetName?: string;
  districtId: number;
  districtName?: string;
  // Per-door fields (isActive, gateType, healthCurrent, etc.) no longer have a single
  // well-defined structure-level value now that a structure can have multiple doors - see
  // GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md item 5. doorCount replaces them here; per-door
  // detail is available via GET /api/GateStructures/{id} -> gateDoors.
  doorCount: number;
}

export interface GateStructureCreateDto {
  name: string;
  description?: string;
  allowEntry?: boolean;
  allowExit?: boolean;
  wgRegionId?: string;
  locationId?: number | null;
  streetId: number;
  districtId: number;
  houseNumber: number;
  iconMaterialRefId?: number | null;

  guardSpawnLocationIds?: number[];
  guardSpawnLocations?: LocationDto[];
  guardCount?: number;
  guardNpcTemplateId?: number | null;

  isOverridable?: boolean;
  animateDuringSiege?: boolean;
  isSiegeObjective?: boolean;
}

export interface GateStructureUpdateDto {
  id: number;
  name: string;
  description?: string;
}

export interface GateStructureStreetNavDto {
  id?: number;
  name?: string;
}

export interface GateStructureDistrictNavDto {
  id?: number;
  name?: string;
  description?: string;
  allowEntry?: boolean;
  allowExit?: boolean;
  wgRegionId?: string;
}
