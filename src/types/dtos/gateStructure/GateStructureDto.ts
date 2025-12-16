import { StructureDto, StructureCreateDto, StructureUpdateDto } from '../structure/StructureDto';
import { StreetDto } from '../street/StreetDto';
import { DistrictDto } from '../district/DistrictDto';
import { MinecraftMaterialRefDto } from '../minecraftMaterialRef/MinecraftMaterialRefDto';

export interface GateStructureDto extends StructureDto {
  isActive?: boolean;
  canRespawn?: boolean;
  isDestroyed?: boolean;
  isInvincible?: boolean;
  isOpened?: boolean;
  healthCurrent?: number;
  healthMax?: number;
  faceDirection?: string;
  respawnRateSeconds?: number;
  iconMaterialRefId?: number;
  regionClosedId?: string;
  regionOpenedId?: string;
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
  isActive: boolean;
  healthCurrent: number;
  isDestroyed: boolean;
}

export interface GateStructureCreateDto extends StructureCreateDto {
  isActive?: boolean;
  canRespawn?: boolean;
  isDestroyed?: boolean;
  isInvincible?: boolean;
  isOpened?: boolean;
  healthCurrent?: number;
  healthMax?: number;
  faceDirection?: string;
  respawnRateSeconds?: number;
  iconMaterialRefId?: number;
  regionClosedId?: string;
  regionOpenedId?: string;
}

export interface GateStructureUpdateDto extends GateStructureCreateDto {
  id: number;
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
