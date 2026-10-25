// Arena duels (KNG-210, knk-workspace docs/specs/arena-duels/DESIGN.md §4.1-4.2, areas rev. 6). Mirrors knk-web-api Dtos/ArenaDtos.cs.

export type DuelGearMode = 'OWN_GEAR_KEEP' | 'OWN_GEAR_DROP' | 'FIXED_KIT' | 'KIT_CHOICE';

export interface ArenaKitDto {
    arenaId?: number | null;
    kitId: number;
    sequenceNumber?: number | null;
    kitName?: string | null;
}

/** Arena duels rev. 6: what an arena area is for. */
export type ArenaAreaKind = 'BATTLEGROUND' | 'SPECTATOR' | 'LOBBY';

/** One WorldGuard region of an arena area (api/Arenas/areas/regions); renamed arena_<arenaId>_<kind>_<id> on save. */
export interface ArenaAreaRegionDto {
    id?: number | null;
    arenaAreaId: number;
    wgRegionId: string;
    worldName?: string | null;
    createdAt?: string | null;
    arenaId?: number | null;
    areaKind?: ArenaAreaKind | null;
    areaKey?: string | null;
}

/**
 * A battleground, spectator area or lobby of an arena (rev. 6: the arena's own sub-structure, not a domain), read and
 * written through api/Arenas/areas. Fields of another kind are cleared by the API; regions are read-only here.
 */
export interface ArenaAreaDto {
    id?: number | null;
    arenaId: number;
    kind: ArenaAreaKind;
    key: string;
    name?: string | null;
    sortOrder?: number | null;
    isEnabled?: boolean | null;
    spawnALocationId?: number | null;
    spawnBLocationId?: number | null;
    arrivalLocationId?: number | null;
    teleportMinTitleBracketId?: number | null;
    teleportPriceGems?: number | null;
    arenaName?: string | null;
    arenaWgRegionId?: string | null;
    teleportMinTitleBracketName?: string | null;
    regions?: ArenaAreaRegionDto[] | null;
}

/** A null setting on create/update keeps its current value (the design default on create). */
export interface ArenaDto {
    id?: number | null;
    name: string;
    key: string;
    description?: string | null;
    wgRegionId: string;
    worldName?: string | null;
    allowEntry?: boolean | null;
    allowExit?: boolean | null;
    locationId?: number | null;
    districtId: number;
    streetId: number;
    houseNumber?: number | null;
    exitLocationId?: number | null;
    isDuelEnabled?: boolean | null;
    maxQueuedMatches?: number | null;
    maxOffers?: number | null;
    offerSeconds?: number | null;
    allowCoinStakes?: boolean | null;
    allowItemStakes?: boolean | null;
    maxCoinStake?: number | null;
    maxItemStacks?: number | null;
    minStakeRatioPercent?: number | null;
    feePercent?: number | null;
    stakeMinAccountAgeHours?: number | null;
    stakeMinTitleBracketId?: number | null;
    maxStakedDuelsPerPairPerDay?: number | null;
    pairCooldownMinutes?: number | null;
    dailyCoinWinCap?: number | null;
    allowOwnGearKeep?: boolean | null;
    allowOwnGearDrop?: boolean | null;
    allowFixedKit?: boolean | null;
    allowKitChoice?: boolean | null;
    defaultGearMode?: DuelGearMode | null;
    warmupSeconds?: number | null;
    countdownSeconds?: number | null;
    fightTimeLimitSeconds?: number | null;
    maxWaitSeconds?: number | null;
    winnerLingerSeconds?: number | null;
    announceMatches?: boolean | null;
    announceFriendly?: boolean | null;
    /** Replace-set in list order; null keeps the current kits. */
    eligibleKits?: ArenaKitDto[] | null;
    /** Read-only: battlegrounds, spectator areas and the lobby with their regions (rev. 6). */
    areas?: ArenaAreaDto[] | null;
    /** Read-only: the arena domain's own sub-regions (KNG-253). */
    subRegions?: { id?: number | null; domainId?: number | null; wgRegionId: string; name?: string | null }[] | null;
}

export interface ArenaListDto {
    id: number;
    name: string;
    key: string;
    description?: string | null;
    wgRegionId: string;
    worldName?: string | null;
    isDuelEnabled: boolean;
    districtId: number;
    districtName?: string | null;
    townName?: string | null;
    battlegroundCount: number;
    areaCount?: number;
}
