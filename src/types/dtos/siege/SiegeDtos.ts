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
    lockdownScenarioArea: boolean;
    allowRecapture: boolean;
    enchantDropsEnabled: boolean;
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
    spatialChecksRun: boolean;
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
