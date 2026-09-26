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
