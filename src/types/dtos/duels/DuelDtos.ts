// knk-web-api api/DuelMatches (arena duels P2, KNG-213; staff pages P7, KNG-221). Enums travel as strings.
// The endpoint contract is in the P2 section of knk-workspace docs/reports/2026-10-21-arena-duels-chain.md.

/** knk-web-api StaffPermissions.DuelReview: the duel history actions, restrictions and DuelPolicy (matched by knk.admin.*). */
export const DUEL_REVIEW_NODE = 'knk.admin.duel.review';

export type DuelGearMode = 'OWN_GEAR_KEEP' | 'OWN_GEAR_DROP' | 'FIXED_KIT' | 'KIT_CHOICE';
export type DuelMatchStatus = 'Created' | 'InProgress' | 'Completed' | 'Cancelled' | 'Aborted';
export type DuelEndReason =
  | 'Win' | 'Forfeit' | 'TimeLimit' | 'AgreedDraw' | 'SimultaneousDeath'
  | 'TeleportFailed' | 'PlayerLeftLobby' | 'NoBattleground' | 'AdminCancelled'
  | 'ServerRestart' | 'ApiOutage';
export type DuelReviewState = 'None' | 'Flagged' | 'Held' | 'Released' | 'Voided';
export type DuelUndeliveredItems = 'None' | 'ReturnToOwners' | 'Destroy';
export type DuelSettlement = 'None' | 'Paid' | 'Held' | 'Refunded';

export const DUEL_STATUSES: DuelMatchStatus[] = ['Created', 'InProgress', 'Completed', 'Cancelled', 'Aborted'];
export const DUEL_REVIEW_STATES: DuelReviewState[] = ['None', 'Flagged', 'Held', 'Released', 'Voided'];

export const GEAR_MODE_LABELS: Record<DuelGearMode, string> = {
  OWN_GEAR_KEEP: 'Own gear, kept',
  OWN_GEAR_DROP: 'Own gear, LOSER DROPS',
  FIXED_KIT: 'Fixed kit',
  KIT_CHOICE: 'Kit choice',
};

export const END_REASON_LABELS: Record<DuelEndReason, string> = {
  Win: 'Win',
  Forfeit: 'Forfeit',
  TimeLimit: 'Draw: time limit',
  AgreedDraw: 'Draw: agreed',
  SimultaneousDeath: 'Draw: both died',
  TeleportFailed: 'Cancelled: teleport failed',
  PlayerLeftLobby: 'Cancelled: player left the lobby',
  NoBattleground: 'Cancelled: no battleground',
  AdminCancelled: 'Cancelled by staff',
  ServerRestart: 'Aborted: server restart',
  ApiOutage: 'Aborted: API outage',
};

/** The review signals (DESIGN §10.3); thresholds are in the DuelPolicy. */
export const DUEL_SIGNALS: Record<string, string> = {
  S1: 'One-sided damage',
  S2: 'Short fight',
  S3: 'Unarmed loser',
  S4: 'Passive loser',
  S5: 'One-way pair',
  S6: 'Funnel from young accounts',
};

export interface DuelItemDto {
  ownerUserId: number;
  material: string;
  amount: number;
  name?: string | null;
  grade?: string | null;
  instanceId?: number | null;
}

export interface DuelSideTelemetryDto {
  damageDealt: number;
  damageTaken: number;
  hits: number;
  attackAttempts: number;
  armorPoints?: number | null;
  mainHand?: string | null;
  hadWeapon?: boolean | null;
}

export interface DuelTelemetryDto {
  durationSeconds: number;
  challenger?: DuelSideTelemetryDto | null;
  opponent?: DuelSideTelemetryDto | null;
}

/** What a revert or confiscation of a paid result recovered (DESIGN §10.3). */
export interface DuelRevertResultDto {
  confiscated: boolean;
  payoutCoins: number;
  recoveredCoins: number;
  feeReversedCoins: number;
  returnedToLoserCoins: number;
  returnedToWinnerCoins: number;
  confiscatedCoins: number;
  missingCoins: number;
  undeliveredItems: DuelUndeliveredItems;
  transactionIds: number[];
}

/** reviewDetails: the signals, which escalation count triggered a hold, and the numbers behind them. */
export interface DuelReviewDetailsDto {
  signals?: string[];
  escalatedByPair?: boolean;
  escalatedByBeneficiary?: boolean;
  values?: Record<string, number | boolean | string>;
}

export interface DuelMatchDto {
  id: number;
  publicToken: string;
  arenaId: number;
  arenaKey?: string | null;
  arenaName?: string | null;
  battlegroundId?: number | null;
  battlegroundKey?: string | null;
  challengerUserId: number;
  challengerUsername?: string | null;
  opponentUserId: number;
  opponentUsername?: string | null;
  gearMode: DuelGearMode;
  fixedKitId?: number | null;
  challengerKitId?: number | null;
  opponentKitId?: number | null;
  status: DuelMatchStatus;
  endReason?: DuelEndReason | null;
  winnerUserId?: number | null;
  challengerCoins: number;
  opponentCoins: number;
  feePercent: number;
  feeCoins: number;
  valueMoving: boolean;
  stakeItems: DuelItemDto[];
  spoilsItems: DuelItemDto[];
  stakeTransactionId?: number | null;
  settlementTransactionId?: number | null;
  feeTransactionId?: number | null;
  refundTransactionId?: number | null;
  review: DuelReviewState;
  reviewTier?: number | null;
  reviewSignals: string[];
  reviewDetails?: DuelReviewDetailsDto | null;
  alertId?: number | null;
  reviewedByUserId?: number | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  revertResult?: DuelRevertResultDto | null;
  undeliveredItems: DuelUndeliveredItems;
  telemetry?: DuelTelemetryDto | null;
  offerCount: number;
  createdAt: string;
  lockedAt: string;
  fightStartedAt?: string | null;
  endedAt?: string | null;
}

/** The answer to release, void, revert and confiscate. */
export interface DuelResultDto {
  match: DuelMatchDto;
  settlement: DuelSettlement;
  alreadyDone: boolean;
  revert?: DuelRevertResultDto | null;
}

export interface DuelMatchQuery {
  userId?: number;
  arenaId?: number;
  status?: DuelMatchStatus | '';
  review?: DuelReviewState | '';
  limit?: number;
}

/** The cross-arena review rules (GET/PUT api/DuelMatches/policy). PUT sends back the loaded updatedAt. */
export interface DuelPolicyDto {
  s1Enabled: boolean;
  s1LoserDamagePercent: number;
  s2Enabled: boolean;
  s2ShortFightSeconds: number;
  s3Enabled: boolean;
  s4Enabled: boolean;
  s4MaxLoserAttackAttempts: number;
  s5Enabled: boolean;
  s5PairDuels: number;
  s6Enabled: boolean;
  s6MinYoungOpponents: number;
  s6YoungAccountDays: number;
  s6WindowDays: number;
  escalationFlagCount: number;
  escalationWindowDays: number;
  updatedAt: string;
  updatedByUserId?: number | null;
}

export interface DuelRestrictionDto {
  id: number;
  userId: number;
  username?: string | null;
  otherUserId?: number | null;
  otherUsername?: string | null;
  reason: string;
  expiresAt?: string | null;
  createdAt: string;
  createdByUserId?: number | null;
  liftedAt?: string | null;
  liftedByUserId?: number | null;
  liftReason?: string | null;
  active: boolean;
}

/** A player (no otherUserId) or a pair; stakes only; optional end date. */
export interface DuelRestrictionCreateDto {
  userId: number;
  otherUserId?: number | null;
  reason: string;
  expiresAt?: string | null;
}

export interface DuelEscalationClearDto {
  userId: number;
  otherUserId?: number | null;
  reason?: string | null;
}

export interface DuelEscalationClearResultDto {
  acknowledgedAlertIds: number[];
}
