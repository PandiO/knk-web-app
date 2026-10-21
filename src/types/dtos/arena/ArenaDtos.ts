// Arena duels (KNG-210, knk-workspace docs/specs/arena-duels/DESIGN.md §4.1-4.2). Mirrors knk-web-api Dtos/ArenaDtos.cs.

export type DuelGearMode = 'OWN_GEAR_KEEP' | 'OWN_GEAR_DROP' | 'FIXED_KIT' | 'KIT_CHOICE';

export interface ArenaKitDto {
    arenaId?: number | null;
    kitId: number;
    sequenceNumber?: number | null;
    kitName?: string | null;
}

export interface ArenaBattlegroundDto {
    id?: number | null;
    name: string;
    description?: string | null;
    allowEntry?: boolean | null;
    allowExit?: boolean | null;
    wgRegionId: string;
    worldName?: string | null;
    locationId?: number | null;
    arenaId: number;
    arenaName?: string | null;
    key: string;
    sortOrder?: number | null;
    isEnabled?: boolean | null;
    spawnALocationId?: number | null;
    spawnBLocationId?: number | null;
}

export interface ArenaSpectatorAreaDto {
    id?: number | null;
    name: string;
    description?: string | null;
    allowEntry?: boolean | null;
    allowExit?: boolean | null;
    wgRegionId: string;
    worldName?: string | null;
    locationId?: number | null;
    arenaId: number;
    arenaName?: string | null;
    teleportEnabled?: boolean | null;
    teleportPriceGems?: number | null;
    teleportMinTitleBracketId?: number | null;
    teleportMinPremiumGroupId?: number | null;
    teleportRequiresDiscovery?: boolean | null;
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
    lobbyLocationId?: number | null;
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
    battlegrounds?: ArenaBattlegroundDto[] | null;
    spectatorAreas?: ArenaSpectatorAreaDto[] | null;
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
}
