import { MinecraftMaterialRefDto } from '../minecraftMaterialRef/MinecraftMaterialRefDto';
import { GateBlockSnapshotDto } from './GateBlockSnapshotDto';
import { LocationDto } from '../locations/LocationModels';

export type GateType = 'SLIDING' | 'TRAP' | 'DRAWBRIDGE' | 'DOUBLE_DOORS';
export type GeometryDefinitionMode = 'PLANE_GRID' | 'FLOOD_FILL';
export type MotionType = 'VERTICAL' | 'LATERAL' | 'ROTATION';
export type FaceDirection =
  | 'NORTH'
  | 'NORTH_EAST'
  | 'EAST'
  | 'SOUTH_EAST'
  | 'SOUTH'
  | 'SOUTH_WEST'
  | 'WEST'
  | 'NORTH_WEST';
export type HealthDisplayMode = 'ALWAYS' | 'DAMAGED_ONLY' | 'NEVER' | 'SIEGE_ONLY';
export type GateInfoDisplayMode = 'ALWAYS' | 'NEVER' | 'SIEGE_ONLY';
export type TileEntityPolicy = 'NONE' | 'DECORATIVE_ONLY' | 'ALL';
export type GateDoorOpenState = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'JAMMED';

/**
 * Item 5 (docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md) moved
 * every per-door field (geometry, animation, health, block snapshots, etc.) off GateStructureDto
 * onto this new GateDoorDto - a GateStructure can now hold multiple independently-animating
 * GateDoors. A handful of these fields can additionally be cascade-overridden from the parent
 * GateStructure (decision 5.0-B) - see GateStructureDto's *Override fields.
 */
export interface GateDoorDto {
  id?: number;
  gateStructureId: number;

  name: string;

  healthCurrent?: number;
  healthMax?: number;
  respawnRateSeconds?: number;

  isActive?: boolean;
  canRespawn?: boolean;
  isDestroyed?: boolean;
  isInvincible?: boolean;
  openedState?: GateDoorOpenState;

  gateType?: GateType;
  geometryDefinitionMode?: GeometryDefinitionMode;
  motionType?: MotionType;
  animationDurationTicks?: number;
  animationTickRate?: number;
  faceDirection?: FaceDirection;

  anchorPointId?: number | null;
  anchorPoint?: LocationDto | null;
  openAnchorPointId?: number | null;
  openAnchorPoint?: LocationDto | null;
  referencePoint1Id?: number | null;
  referencePoint1?: LocationDto | null;
  referencePoint2Id?: number | null;
  referencePoint2?: LocationDto | null;
  geometryWidth?: number;
  geometryHeight?: number;
  geometryDepth?: number;
  motionDistanceBlocks?: number;
  clipToGeometryBounds?: boolean;

  seedBlocks?: string;
  scanMaxBlocks?: number;
  scanMaxRadius?: number;
  scanMaterialWhitelist?: string;
  scanMaterialBlacklist?: string;
  scanPlaneConstraint?: boolean;

  fallbackMaterialRefId?: number | null;
  tileEntityPolicy?: TileEntityPolicy;

  rotationMaxAngleDegrees?: number;
  hingeAxisId?: number | null;
  hingeAxis?: LocationDto | null;
  leftDoorSeedBlockId?: number | null;
  leftDoorSeedBlock?: LocationDto | null;
  rightDoorSeedBlockId?: number | null;
  rightDoorSeedBlock?: LocationDto | null;
  mirrorRotation?: boolean;

  regionClosedId?: string;
  regionOpenedId?: string;

  allowPassThrough?: boolean;
  passThroughDurationSeconds?: number;
  passThroughConditionsJson?: string;

  infoDisplayLocationId?: number | null;
  infoDisplayLocation?: LocationDto | null;
  showHealthDisplay?: boolean;
  healthDisplayMode?: HealthDisplayMode;
  healthDisplayYOffset?: number;
  gateNameDisplayMode?: GateInfoDisplayMode;
  statusDisplayMode?: GateInfoDisplayMode;
  doorNameDisplayMode?: GateInfoDisplayMode;

  allowContinuousDamage?: boolean;
  continuousDamageMultiplier?: number;
  continuousDamageDurationSeconds?: number;

  blockSnapshots?: GateBlockSnapshotDto[];
  openedBlockSnapshots?: GateBlockSnapshotDto[];

  fallbackMaterialRef?: MinecraftMaterialRefDto;
}

export interface GateDoorStateUpdateDto {
  openedState: GateDoorOpenState;
  isDestroyed: boolean;
}

export interface GateDoorHealthUpdateDto {
  healthCurrent: number;
}

export interface GateDoorOperationalSettingsUpdateDto {
  isActive: boolean;
  isInvincible: boolean;
}
