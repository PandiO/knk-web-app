// Mirrors knk-web-api's Dtos/KitDtos.cs KitDto/KitContentDto (DESIGN.md §2.1/§2.2).
export interface KitDto {
    id?: number;
    name: string;
    description?: string;
    helmetId?: number;
    chestplateId?: number;
    leggingsId?: number;
    bootsId?: number;
    shieldId?: number;
    handId?: number;
    contents?: KitContentDto[];
    minTitleBracketId?: number;
    requiredPermissionGroupId?: number;
    requiredPermissionNode?: string;
    grantOnFirstJoin: boolean;
    cooldownSeconds: number;
    costAmount?: number;
    costCurrency?: string;
    isSinglePurchasePremium: boolean;
    premiumPriceGems?: number;
}

export interface KitContentDto {
    slotIndex: number;
    itemBlueprintId: number;
    quantity: number;
}
