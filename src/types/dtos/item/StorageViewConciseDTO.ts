import { StorageItemDTO } from "./StorageItemDTO";

export interface StorageViewConciseDTO {
    id: number;
    name: string;
    capacityMax: number;
    capacity: number;
    itemAmountMax: number;
    itemAmount: number;
    structureId?: number;
    structureName?: string;
    userId?: string;
    userName?: string;
    contents?: StorageItemDTO[];
}