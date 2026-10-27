// Siege Phase 3 - mirrors knk-web-api Dtos/SiegeDtos.cs (docs/specs/siege-minigame/DESIGN.md §3.3-3.9).
// Only the shapes the web app reads or writes; the runtime-config payload is plugin-only.
import { LocationDto } from '../locations/LocationModels';

export type SiegeTeamRole = 'Defender' | 'Attacker';
export type SiegeLobbyMode = 'Continuous' | 'Scheduled';
// Gates at rest - the API refuses OPENING/CLOSING/JAMMED for these fields.
export type SiegeGateRestingState = 'OPEN' | 'CLOSED';
export type SiegeNonMemberGateView = 'PreLockdownView' | 'PassThroughOnly';

export interface SiegeScenarioDistrictDto {
    siegeScenarioId?: number;
    districtId: number;
    districtName?: string | null;
}

export interface SiegeScenarioGateDto {
    siegeScenarioId?: number;
    gateStructureId: number;
    gateStructureName?: string | null;
    // null/0 -> the scenario's first Defender team.
    initialOwnerTeamId?: number | null;
    initialState: SiegeGateRestingState;
    damageable: boolean;
}

export interface SiegeSpawnpointDto {
    id?: number;
    siegeTeamId: number;
    sortOrder?: number | null;
    name: string;
    locationId?: number | null;
    location?: LocationDto | null;
    safeZoneRadius: number;
}

export interface SiegeTeamDto {
    id?: number;
    siegeScenarioId: number;
    sortOrder?: number | null;
    role: SiegeTeamRole;
    allianceGroup: number;
    clanId?: number | null;
    clanName?: string | null;
    name?: string | null;
    chatColor?: string | null;
    bannerDesignId?: number | null;
    startMessage?: string | null;
    // Identity after the Clan fallback (read-only).
    resolvedName?: string | null;
    resolvedChatColor?: string | null;
    resolvedBannerDesignId?: number | null;
    spawnpoints?: SiegeSpawnpointDto[];
}

export interface SiegeObjectiveDto {
    id?: number;
    siegeScenarioId: number;
    sortOrder?: number | null;
    name: string;
    locationId?: number | null;
    location?: LocationDto | null;
    gateStructureId?: number | null;
    gateStructureName?: string | null;
    capturePoints: number;
    captureRadius: number;
    instantVictory: boolean;
    initialHolderTeamId?: number | null;
    spawnWhenHeld: boolean;
    gateStateOnCapture: SiegeGateRestingState;
}

export interface SiegeScenarioDto {
    id?: number;
    name: string;
    description?: string | null;
    townId: number;
    townName?: string | null;
    // M2M sets: null/omitted keeps the saved set, [] clears it.
    districts?: SiegeScenarioDistrictDto[] | null;
    hubLocationId?: number | null;
    hubLocation?: LocationDto | null;
    playersMin: number;
    playersMax: number;
    minTitleBracketId?: number | null;
    matchDurationMinSeconds: number;
    matchDurationPerPlayerSeconds: number;
    matchDurationMaxSeconds: number;
    coinRewardWin: number;
    expRewardWin: number;
    gemRewardWin: number;
    coinRewardHolding: number;
    expRewardHolding: number;
    coinRewardCapture: number;
    expRewardCapture: number;
    /** Alpha run 1 (PandiO/knk-workspace#165): coins/XP per full `gateDamageRewardStep` HP of gate damage. */
    gateDamageRewardStep?: number;
    coinRewardGateDamage?: number;
    expRewardGateDamage?: number;
    /** #166: paid when the member was active (not AFK) at least `participationMinActivePercent` % of their match time. */
    coinRewardParticipation?: number;
    expRewardParticipation?: number;
    participationMinActivePercent?: number;
    lockdownScenarioArea: boolean;
    allowRecapture: boolean;
    enchantDropsEnabled: boolean;
    /** KNG-234: Inherit follows the global setting; the lobby's own choice wins over this one. */
    navigationItem?: SiegeNavigationItemMode;
    // Owned children - read-only here, created/edited through their own endpoints.
    teams?: SiegeTeamDto[];
    objectives?: SiegeObjectiveDto[];
    gates?: SiegeScenarioGateDto[] | null;
}

export interface SiegeScenarioListDto {
    id: number;
    name: string;
    townId: number;
    townName?: string | null;
    teamCount: number;
    objectiveCount: number;
    gateCount: number;
}

export interface SiegeReadinessIssueDto {
    code: string;
    message: string;
    entityType?: string | null;
    entityId?: number | null;
}

export interface SiegeScenarioReadinessDto {
    siegeScenarioId: number;
    isReady: boolean;
    // False when some configured field-validation rules couldn't run (plugin unreachable).
    spatialChecksRun: boolean;
    // Field-validation rule checks that ran; 0 = no rules configured on the siege forms.
    fieldRuleChecks?: number;
    errors: SiegeReadinessIssueDto[];
    warnings: SiegeReadinessIssueDto[];
}

export interface SiegeLobbyScenarioDto {
    siegeLobbyId?: number;
    siegeScenarioId: number;
    siegeScenarioName?: string | null;
    weight: number;
}

export interface SiegeLobbyDto {
    id?: number;
    name: string;
    key: string;
    isEnabled: boolean;
    mode: SiegeLobbyMode;
    matchmakingSeconds: number;
    cooldownSeconds: number;
    voteCandidateCount: number;
    allowRandomVote: boolean;
    /** KNG-234: wins over the scenario's choice and the global setting. */
    navigationItem?: SiegeNavigationItemMode;
    scheduleJson?: string | null;
    rotation?: SiegeLobbyScenarioDto[] | null;
}

export interface SiegeLobbyListDto {
    id: number;
    name: string;
    key: string;
    isEnabled: boolean;
    mode: SiegeLobbyMode;
    rotationCount: number;
}

/** Whether siege players get the navigation compass at the hub: a lobby's or scenario's own choice, or defer upward. */
export type SiegeNavigationItemMode = 'Inherit' | 'Give' | 'DoNotGive';

export interface SiegeConfigurationDto {
    captureAttackBase: number;
    captureAttackPerExtra: number;
    captureAttackPerExtraInstantVictory: number;
    captureDefendBase: number;
    captureDefendPerExtra: number;
    captureDefendPerExtraInstantVictory: number;
    sideCaptureReduction: number;
    voteCloseSecondsBeforeStart: number;
    drawSecondsBeforeStart: number;
    hubSecondsBeforeStart: number;
    teamSplitSecondsBeforeStart: number;
    matchmakingAnnouncementMarks: number[];
    killAnnouncementThresholds: number[];
    killStreakAnnounceAbove: number;
    headshotMultiplier: number;
    allowedCommands: string[];
    spawnPickerDelayTicks: number;
    enchantDropChancePerMille: number;
    allowedEnchantmentKeys: string[];
    enchantLevelMin: number;
    enchantLevelMax: number;
    maxBooksAlive: number;
    nonMemberGateView: SiegeNonMemberGateView;
    /** KNG-234: the global default for giving players the navigation compass at the hub. */
    giveNavigationItem: boolean;
    /** Seconds of matchmaking left after /siege skip (players with knk.siege.skip); floored at vote close + 1 by the plugin. */
    playerSkipMatchmakingSeconds: number;
    /** Seconds of matchmaking left after /siege admin skip; same floor (legacy T-31). */
    adminSkipMatchmakingSeconds: number;
    updatedAt?: string;
}

// PUT is partial: omitted properties keep their current value.
export type UpdateSiegeConfigurationDto = Partial<Omit<SiegeConfigurationDto, 'updatedAt'>>;

export interface TitleBracketDto {
    id: number;
    name: string;
    maleName: string;
    femaleName: string;
    minExperience: number;
}
