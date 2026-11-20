import type { SiegeWeaponKind } from './SiegeWeaponDtos';

// Siege shop L4 (knk-workspace docs/specs/siege-shop/DESIGN.md § 4.2, § 6.2.3-6.2.4; PandiO/knk-workspace#869):
// knk-web-api SiegeWeaponUnlocksController. A player unlocks a siege weapon type once with coins (and an optional
// minimum title) to be allowed to buy it in siege matches.

/** The API's order of checks: unlocked already, then the title, then the coins. */
export type SiegeWeaponUnlockState = 'Unlocked' | 'NeedsTitle' | 'NeedsCoins' | 'Unlockable';

export interface SiegeWeaponUnlockOfferDto {
    templateId: number;
    name: string;
    description?: string | null;
    kind: SiegeWeaponKind;
    unlockPrice: number;
    minTitleLevel?: number | null;
    /** The minimum title's name for the player, null without a minimum. */
    minTitleName?: string | null;
    unlocked: boolean;
    unlockedAt?: string | null;
    meetsTitle: boolean;
    canAfford: boolean;
    state: SiegeWeaponUnlockState;
}

/** GET api/SiegeWeaponUnlocks/mine */
export interface SiegeWeaponUnlocksOverviewDto {
    userId: number;
    coins: number;
    titleLevel?: number | null;
    titleName?: string | null;
    offers: SiegeWeaponUnlockOfferDto[];
}

/** POST api/SiegeWeaponUnlocks/purchase: a web user buys for themselves (no userId). */
export interface SiegeWeaponUnlockPurchaseRequestDto {
    templateId: number;
}

export interface SiegeWeaponUnlockPurchaseResultDto {
    templateId: number;
    templateName: string;
    userId: number;
    /** 0 when it was unlocked already (nothing charged) or free. */
    coinsPaid: number;
    alreadyUnlocked: boolean;
    unlockedAt: string;
    /** The player's coins after the purchase. */
    coins: number;
}
