export interface GateBlockSnapshotDto {
  id?: number;
  gateStructureId: number;
  relativeX: number;
  relativeY: number;
  relativeZ: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  materialName: string;
  blockDataJson?: string;
  tileEntityJson?: string;
  sortOrder: number;
}

export interface GateBlockSnapshotCreateDto {
  relativeX: number;
  relativeY: number;
  relativeZ: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  materialName: string;
  blockDataJson?: string;
  tileEntityJson?: string;
  sortOrder: number;
}
