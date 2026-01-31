import { MinecraftMaterialRefDto } from '../minecraftMaterialRef/MinecraftMaterialRefDto';
import { GateBlockSnapshotDto } from './GateBlockSnapshotDto';

export type GateType = 'SLIDING' | 'TRAP' | 'DRAWBRIDGE' | 'DOUBLE_DOORS';
export type GeometryDefinitionMode = 'PLANE_GRID' | 'FLOOD_FILL';
export type MotionType = 'VERTICAL' | 'LATERAL' | 'ROTATION';
export type FaceDirection =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';
export type TileEntityPolicy = 'DECORATIVE_ONLY' | 'CONTAINER_SAFE';

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

  isActive?: boolean;
  canRespawn?: boolean;
  isDestroyed?: boolean;
  isInvincible?: boolean;
  isOpened?: boolean;
  healthCurrent?: number;
  healthMax?: number;
  faceDirection?: FaceDirection;
  respawnRateSeconds?: number;
  iconMaterialRefId?: number | null;
  regionClosedId?: string;
  regionOpenedId?: string;

  gateType?: GateType;
  geometryDefinitionMode?: GeometryDefinitionMode;
  motionType?: MotionType;
  animationDurationTicks?: number;
  animationTickRate?: number;

  anchorPoint?: string;
  referencePoint1?: string;
  referencePoint2?: string;
  geometryWidth?: number;
  geometryHeight?: number;
  geometryDepth?: number;

  seedBlocks?: string;
  scanMaxBlocks?: number;
  scanMaxRadius?: number;
  scanMaterialWhitelist?: string;
  scanMaterialBlacklist?: string;
  scanPlaneConstraint?: boolean;

  fallbackMaterialRefId?: number | null;
  tileEntityPolicy?: TileEntityPolicy;

  rotationMaxAngleDegrees?: number;
  hingeAxis?: string;
  leftDoorSeedBlock?: string;
  rightDoorSeedBlock?: string;
  mirrorRotation?: boolean;

  allowPassThrough?: boolean;
  passThroughDurationSeconds?: number;
  passThroughConditionsJson?: string;

  guardSpawnLocationsJson?: string;
  guardCount?: number;
  guardNpcTemplateId?: number | null;

  showHealthDisplay?: boolean;
  healthDisplayMode?: string;
  healthDisplayYOffset?: number;

  isOverridable?: boolean;
  animateDuringSiege?: boolean;
  currentSiegeId?: number | null;
  isSiegeObjective?: boolean;

  allowContinuousDamage?: boolean;
  continuousDamageMultiplier?: number;
  continuousDamageDurationSeconds?: number;

  blockSnapshots?: GateBlockSnapshotDto[];
  street?: GateStructureStreetNavDto;
  district?: GateStructureDistrictNavDto;
  iconMaterialRef?: MinecraftMaterialRefDto;
  fallbackMaterialRef?: MinecraftMaterialRefDto;
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
  isActive: boolean;
  healthCurrent: number;
  healthMax?: number;
  isDestroyed: boolean;
  isOpened?: boolean;
  gateType?: GateType;
  faceDirection?: FaceDirection;
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

  gateType?: GateType;
  geometryDefinitionMode?: GeometryDefinitionMode;
  motionType?: MotionType;
  faceDirection?: FaceDirection;

  anchorPoint?: string;
  referencePoint1?: string;
  referencePoint2?: string;
  geometryWidth?: number;
  geometryHeight?: number;
  geometryDepth?: number;

  seedBlocks?: string;
  scanMaxBlocks?: number;
  scanMaxRadius?: number;
  scanMaterialWhitelist?: string;
  scanMaterialBlacklist?: string;
  scanPlaneConstraint?: boolean;

  animationDurationTicks?: number;
  animationTickRate?: number;

  fallbackMaterialRefId?: number | null;
  tileEntityPolicy?: TileEntityPolicy;

  rotationMaxAngleDegrees?: number;
  hingeAxis?: string;
  leftDoorSeedBlock?: string;
  rightDoorSeedBlock?: string;
  mirrorRotation?: boolean;

  healthMax?: number;
  isInvincible?: boolean;
  canRespawn?: boolean;
  respawnRateSeconds?: number;

  regionClosedId?: string;
  regionOpenedId?: string;
}

export interface GateStructureUpdateDto {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  healthMax: number;
  isInvincible: boolean;
  canRespawn: boolean;
  respawnRateSeconds: number;
  animationDurationTicks: number;
  animationTickRate: number;
  regionClosedId?: string;
  regionOpenedId?: string;
}

export interface GateStateUpdateDto {
  isOpened: boolean;
  isDestroyed: boolean;
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
