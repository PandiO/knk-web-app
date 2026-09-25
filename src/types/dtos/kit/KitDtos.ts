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

// Mirrors knk-web-api's Dtos/KitDtos.cs KitAvailabilityDto — per-kit availability summary for a
// given user, what both /kit list (in-game) and this "Grant Kit" UI render from (DESIGN.md §4.1's
// GetAvailableForUserAsync / §4.6).
export interface KitAvailabilityDto {
    kitId: number;
    name: string;
    description?: string;
    canClaim: boolean;
    denialReason?: string;
    cooldownExpiresAt?: string;
    isPurchased: boolean;
    costAmount?: number;
    costCurrency?: string;
    isSinglePurchasePremium: boolean;
    premiumPriceGems?: number;
}

// Mirrors knk-web-api's Dtos/KitDtos.cs KitContentSlotDto — one resolved (SlotIndex,
// ItemBlueprintId, Quantity) entry within a KitClaimResultDto.
export interface KitContentSlotDto {
    slotIndex: number;
    itemBlueprintId: number;
    quantity: number;
}

// Mirrors knk-web-api's Dtos/KitDtos.cs KitClaimResultDto — the resolved loadout returned by a
// successful claim/give call (DESIGN.md §4.1/§4.2).
export interface KitClaimResultDto {
    kitId: number;
    helmetId?: number;
    chestplateId?: number;
    leggingsId?: number;
    bootsId?: number;
    shieldId?: number;
    handId?: number;
    contents: KitContentSlotDto[];
}

// Mirrors knk-web-api's Dtos/KitDtos.cs GiveKitRequestDto — body for POST api/Kits/{id}/give.
// actorUserId is deliberately not a field here; it's resolved server-side from the caller's JWT.
export interface GiveKitRequestDto {
    targetUserId: number;
}
