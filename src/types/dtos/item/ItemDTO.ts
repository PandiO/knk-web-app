export interface ItemDTO {
    id: number;
    name: string;
    displayName?: string;
    basePrice: number;
    baseItemId?: number;
    categoryId: number;
    gradeId: number;
    itemtypeId: number;
    itemtypeName: string;
    blockData?: string;
    data: number;
}