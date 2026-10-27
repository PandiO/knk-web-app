// Alpha run 1 (PandiO/knk-workspace#174): the public siege results log (knk-web-api SiegeMatchesController
// GET api/siege-matches/public/users/{userId} and public/{id}). Match facts are public; a participant's own numbers
// follow their statistics visibility settings and are null when hidden from this viewer.

export type SiegeMatchStatus = 'Created' | 'InProgress' | 'Completed' | 'Aborted';
export type SiegeMatchEndReason =
    | 'InstantVictory' | 'TimeExpired' | 'TeamEliminated' | 'NotEnoughPlayers'
    | 'AdminStopped' | 'ServerRestart' | 'ApiOutage';
/** Win, Loss or Draw; Left for a player who left before the end; Aborted for an aborted match. */
export type SiegeMatchOutcome = 'Win' | 'Loss' | 'Draw' | 'Left' | 'Aborted';

export interface SiegeMatchPublicTeamDto {
    id: number;
    name: string;
    chatColor: string;
    role: 'Defender' | 'Attacker';
    allianceGroup: number;
    outcome: SiegeMatchOutcome;
}

export interface SiegeMatchPublicParticipantDto {
    userId: number;
    username?: string | null;
    siegeTeamId?: number | null;
    outcome: SiegeMatchOutcome;
    presentAtEnd: boolean;
    leftAt?: string | null;
    kills?: number | null;
    deaths?: number | null;
    highestKillStreak?: number | null;
    captures?: number | null;
    gateDamage?: number | null;
    activeSeconds: number;
    matchSeconds: number;
    coinsAwarded?: number | null;
    gemsAwarded?: number | null;
    expAwarded: number;
}

export interface SiegeMatchPublicCaptureDto {
    siegeTeamId?: number | null;
    capturedByUserId?: number | null;
    capturedByUsername?: string | null;
    capturedAt?: string | null;
}

export interface SiegeMatchPublicObjectiveDto {
    siegeObjectiveId?: number | null;
    name?: string | null;
    instantVictory: boolean;
    finalHolderTeamId?: number | null;
    captures: SiegeMatchPublicCaptureDto[];
}

export interface SiegeMatchPublicDto {
    id: number;
    siegeLobbyName?: string | null;
    siegeScenarioName?: string | null;
    status: SiegeMatchStatus;
    startedAt?: string | null;
    endedAt?: string | null;
    endReason?: SiegeMatchEndReason | null;
    winningAllianceGroup?: number | null;
    teams: SiegeMatchPublicTeamDto[];
    participants: SiegeMatchPublicParticipantDto[];
    objectives: SiegeMatchPublicObjectiveDto[];
}

export interface SiegeMatchPublicSummaryDto {
    id: number;
    siegeLobbyName?: string | null;
    siegeScenarioName?: string | null;
    status: SiegeMatchStatus;
    startedAt?: string | null;
    endedAt?: string | null;
    endReason?: SiegeMatchEndReason | null;
    participantCount: number;
    team?: SiegeMatchPublicTeamDto | null;
    participant: SiegeMatchPublicParticipantDto;
}

export const SIEGE_END_REASON_LABELS: Record<SiegeMatchEndReason, string> = {
    InstantVictory: 'Main objective captured',
    TimeExpired: 'Time ran out',
    TeamEliminated: 'Only one side had players left',
    NotEnoughPlayers: 'Too few players left',
    AdminStopped: 'Stopped by an admin',
    ServerRestart: 'Server restart',
    ApiOutage: 'Server services were down',
};

export const SIEGE_OUTCOME_LABELS: Record<SiegeMatchOutcome, string> = {
    Win: 'Win',
    Loss: 'Loss',
    Draw: 'Draw',
    Left: 'Left early',
    Aborted: 'Aborted',
};

/** Tailwind classes for an outcome badge. */
export const siegeOutcomeBadgeClass = (outcome: SiegeMatchOutcome): string => {
    switch (outcome) {
        case 'Win': return 'bg-green-100 text-green-800';
        case 'Loss': return 'bg-red-100 text-red-800';
        case 'Draw': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-700';
    }
};

/** A Bukkit ChatColor name as a CSS colour, for team names (dark ones readable on white). */
export const siegeTeamColor = (chatColor?: string | null): string => {
    switch ((chatColor ?? '').toUpperCase()) {
        case 'BLACK': return '#000000';
        case 'DARK_BLUE': return '#0000AA';
        case 'DARK_GREEN': return '#00AA00';
        case 'DARK_AQUA': return '#00AAAA';
        case 'DARK_RED': return '#AA0000';
        case 'DARK_PURPLE': return '#AA00AA';
        case 'GOLD': return '#B8860B';
        case 'GRAY': return '#6B7280';
        case 'DARK_GRAY': return '#555555';
        case 'BLUE': return '#3B5BDB';
        case 'GREEN': return '#2F9E44';
        case 'AQUA': return '#0C8599';
        case 'RED': return '#E03131';
        case 'LIGHT_PURPLE': return '#C2255C';
        case 'YELLOW': return '#B08900';
        default: return '#374151';
    }
};

/** "12" or "Hidden" for a statistic the player keeps private. */
export const formatSiegeNumber = (value?: number | null): string =>
    value === null || value === undefined ? 'Hidden' : value.toLocaleString('en-US');
