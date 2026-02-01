import { ItemDTO } from "./ItemDTO";

export interface StorageItemDTO {
    storageId: number;
    itemId: number;
    amount?: number;
    item: ItemDTO;
}