// knk-web-api Dtos/CurrencyDtos.cs (currency ledger, KNG-21 Phase 3 / KNG-23).

export type LedgerCurrency = 'Coins' | 'Gems' | 'Experience';

/** One change to a player's coins, gems or XP as the ledger recorded it. */
export interface LedgerLineDto {
  entryId: number;
  transactionId: number;
  publicId: string;
  /** UTC; the API may omit the offset. */
  createdAt: string;
  userId: number;
  username?: string | null;
  currency: LedgerCurrency;
  operation: 'Add' | 'Remove' | 'Set';
  /** Signed. */
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  kind: string;
  reasonCode: string;
  reason: string;
  initiator: 'Player' | 'Admin' | 'System' | 'PluginService' | string;
  initiatorUserId?: number | null;
  initiatorUsername?: string | null;
  initiatorComponent?: string | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  correlationId?: string | null;
  /** Set on a reversal: the internal id of the transaction it reversed. */
  reversesTransactionId?: number | null;
  metadataJson?: string | null;
  /** The other player of a transfer. */
  counterpartyUserId?: number | null;
  counterpartyUsername?: string | null;
}

export interface LedgerPageDto {
  items: LedgerLineDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface BalancesDto {
  userId: number;
  coins: number;
  gems: number;
  experiencePoints: number;
}

// ===== Staff: api/currency/admin (currency-payments Phase 4, KNG-23 balance event log) =====

/** Columns the balance event log can sort by (server-side). */
export type LedgerSortKey = 'createdAt' | 'recipient' | 'currency' | 'operation' | 'amount' | 'balanceAfter' | 'initiator' | 'reason';

/** GET api/currency/admin/ledger - every filter optional; `to` is exclusive (UTC). */
export interface LedgerQuery {
  currency?: 'coins' | 'gems' | 'xp';
  recipient?: string;
  userId?: number;
  initiator?: string;
  initiatorType?: 'Player' | 'Admin' | 'System' | 'PluginService';
  source?: string;
  reason?: string;
  kind?: string;
  transaction?: string;
  from?: string;
  to?: string;
  sort?: LedgerSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface CurrencyEntryDetailDto {
  entryId: number;
  currency: LedgerCurrency;
  accountKind: 'User' | 'System';
  userId?: number | null;
  username?: string | null;
  systemAccount?: string | null;
  operation: 'Add' | 'Remove' | 'Set';
  amount: number;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
}

export interface CurrencyTransactionDetailDto {
  transactionId: number;
  publicId: string;
  createdAt: string;
  kind: string;
  reasonCode: string;
  reason: string;
  sourceType?: string | null;
  sourceRef?: string | null;
  initiator: string;
  initiatorUserId?: number | null;
  initiatorUsername?: string | null;
  initiatorComponent?: string | null;
  idempotencyScope: string;
  correlationId?: string | null;
  metadataJson?: string | null;
  reversesPublicId?: string | null;
  reversedByPublicId?: string | null;
  /** When it was reversed (UTC); set with reversedByPublicId. */
  reversedAt?: string | null;
  /** The staff member who reversed it (null: reversed by the game server without a named staff member). */
  reversedByUserId?: number | null;
  reversedByUsername?: string | null;
  reversible: boolean;
  entries: CurrencyEntryDetailDto[];
}

/** `details` of a 409 AlreadyReversed from POST admin/transactions/{publicId}/reverse (KNG-21). */
export interface AlreadyReversedDetailsDto {
  reversalTransactionPublicId: string;
  reversedAt: string;
  reversedByUserId?: number | null;
  reversedByUsername?: string | null;
}

export interface PostedEntryDto {
  userId: number;
  currency: LedgerCurrency;
  operation: 'Add' | 'Remove' | 'Set';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface PostingResultDto {
  transactionId: number;
  publicId: string;
  replayed: boolean;
  reasonCode: string;
  createdAt: string;
  entries: PostedEntryDto[];
}

export interface ReversalResultDto {
  reversedPublicId: string;
  posting: PostingResultDto;
  partial: boolean;
}

export interface TransferLockDto {
  userId: number;
  username?: string | null;
  locked: boolean;
  reason?: string | null;
  lockedAt?: string | null;
}

/** A currency's policy (DESIGN.md §3.5). 0 on a cap, cooldown or hourly limit = no limit. */
export interface CurrencyPolicyDto {
  currency: 'Coins' | 'Gems';
  transfersEnabled: boolean;
  transferable: boolean;
  minTransfer: number;
  maxTransfer: number;
  dailySendCap: number;
  dailyReceiveCap: number;
  confirmThreshold: number;
  confirmTtlSeconds: number;
  cooldownSeconds: number;
  maxTransfersPerHour: number;
  minSenderAccountAgeHours: number;
  minSenderTitleBracketId?: number | null;
  transferFeeBasisPoints: number;
  maxBalance: number;
  adminDailyGrantCapPerActor: number;
  signupGrant: number;
  updatedAt: string;
  updatedByUserId?: number | null;
  /** The cap the database enforces; maxBalance may only be lower. */
  hardMaxBalance: number;
}

/** POST api/currency/admin/adjustments. */
export interface AdminAdjustmentDto {
  targetUserId: number;
  currency: LedgerCurrency;
  mode: 'Add' | 'Remove' | 'Set';
  amount: number;
  expectedCurrent?: number;
  category: AdjustmentCategory;
  note: string;
  notifyPlayer?: boolean;
}

/** knk-web-api AdminAdjustmentCategories (a staff adjustment's reason category). */
export const ADJUSTMENT_CATEGORIES = [
  { value: 'COMPENSATION', label: 'Compensation' },
  { value: 'EVENT_PRIZE', label: 'Event prize' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'CORRECTION', label: 'Correction' },
  { value: 'PENALTY', label: 'Penalty' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type AdjustmentCategory = typeof ADJUSTMENT_CATEGORIES[number]['value'];

/** A staff note (adjustment, reversal) must be at least this long - the API checks it too. */
export const MIN_STAFF_NOTE_LENGTH = 10;

/** The in-game /knk user nodes for changing each balance (knk-web-api StaffPermissions); an XP increase needs all three. */
export const BALANCE_NODES = {
  coins: 'knk.admin.user.coins',
  gems: 'knk.admin.user.gems',
  xp: 'knk.admin.user.xp',
} as const;

/** The staff nodes of the currency pages (knk-web-api StaffPermissions, DESIGN.md §3.8). */
export const CURRENCY_NODES = {
  history: 'knk.admin.currency.history',
  reverse: 'knk.admin.currency.reverse',
  lock: 'knk.admin.currency.lock',
  policy: 'knk.admin.currency.policy',
  alerts: 'knk.admin.currency.alerts',
} as const;

// ===== Currency monitor: alerts and reconciliation (Phase 5, DESIGN.md §3.9) =====

export type CurrencyAlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

/** knk-web-api CurrencyAlertDto: one anomaly finding (rules R1–R9). */
export interface CurrencyAlertDto {
  id: number;
  rule: string;
  ruleName: string;
  severity: CurrencyAlertSeverity;
  summary: string;
  userId?: number | null;
  username?: string | null;
  transactionId?: number | null;
  transactionPublicId?: string | null;
  /** Rule-specific facts (thresholds, counts, mismatches…). */
  details?: Record<string, unknown> | null;
  createdAt: string;
  ackedAt?: string | null;
  ackedByUserId?: number | null;
  ackedByUsername?: string | null;
}

export interface CurrencyAlertPageDto {
  items: CurrencyAlertDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  openCount: number;
  openBySeverity: Partial<Record<CurrencyAlertSeverity, number>>;
}

export type CurrencyAlertStatus = 'open' | 'acked' | 'all';

/** GET admin/alerts filters; empty values are left out. */
export interface CurrencyAlertQuery {
  status?: CurrencyAlertStatus;
  /** This severity and above. */
  severity?: CurrencyAlertSeverity | '';
  rule?: string;
  userId?: number;
  page?: number;
  pageSize?: number;
}

/** knk-web-api CurrencyMismatchDto (reconciler). */
export interface CurrencyMismatchDto {
  userId: number;
  currency: string;
  /** BalanceColumn, Arithmetic, Chain or UnbalancedTransaction. */
  kind: string;
  expected?: number | null;
  actual?: number | null;
  entryId?: number | null;
  transactionId?: number | null;
}

export interface CurrencyReconciliationRunDto {
  startedAt: string;
  finishedAt?: string | null;
  durationMs: number;
  trigger: string;
  triggeredByUserId?: number | null;
  mismatchCount: number;
  mismatches: CurrencyMismatchDto[];
  truncated: boolean;
  error?: string | null;
  alertIds: number[];
  transfersDisabled: string[];
}

export interface CurrencyReconciliationStatusDto {
  lastRun?: CurrencyReconciliationRunDto | null;
  running: boolean;
  monitorEnabled: boolean;
  intervalMinutes: number;
}

/** The rules of DESIGN.md §3.9, for the filter dropdown. */
export const CURRENCY_ALERT_RULES = [
  { value: 'R1', label: 'R1 Reconciliation mismatch' },
  { value: 'R2', label: 'R2 Unbalanced transaction' },
  { value: 'R3', label: 'R3 Funnel' },
  { value: 'R4', label: 'R4 Ping-pong' },
  { value: 'R5', label: 'R5 Velocity' },
  { value: 'R6', label: 'R6 Staff adjustments' },
  { value: 'R7', label: 'R7 Mint rate' },
  { value: 'R8', label: 'R8 Balance cap hit' },
  { value: 'R9', label: 'R9 Probing' },
] as const;
