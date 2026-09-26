import { logging, Controllers, HttpMethod } from '../utils';
import {
  AdminAdjustmentDto,
  BalancesDto,
  CurrencyAlertDto,
  CurrencyAlertPageDto,
  CurrencyAlertQuery,
  CurrencyPolicyDto,
  CurrencyReconciliationRunDto,
  CurrencyReconciliationStatusDto,
  CurrencyTransactionDetailDto,
  LedgerPageDto,
  LedgerQuery,
  ReversalResultDto,
  TransferLockDto,
} from '../types/dtos/currency/CurrencyDtos';
import { BalanceAdjustmentResultDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';
import { ObjectManager } from './objectManager';

/** 'coins' | 'gems' | 'xp' filter for the history, or undefined for all three. */
export type LedgerFilter = 'coins' | 'gems' | 'xp';

// knk-web-api api/currency (currency ledger, KNG-21 Phase 3) and the staff api/currency/admin
// routes (Phase 4; alerts and reconciliation Phase 5). Payments between players are in-game only (currency DESIGN.md §5 Q4), so
// there is no transfer call here. Staff writes send an Idempotency-Key the caller keeps for the
// whole submission (the same key on a retry of the same form).
class CurrencyClient extends ObjectManager {
  private static instance: CurrencyClient;

  public static getInstance() {
    if (!CurrencyClient.instance) {
      CurrencyClient.instance = new CurrencyClient();
      CurrencyClient.instance.logger = logging.getLogger('CurrencyClient');
    }
    return CurrencyClient.instance;
  }

  /** Current balances straight from the API (own account, or any with knk.admin.currency.history). */
  getBalances(userId: number): Promise<BalancesDto> {
    return this.invokeServiceCall(null, `balances/${userId}`, Controllers.Currency, HttpMethod.Get);
  }

  /** A player's ledger history, newest first. */
  getTransactions(userId: number, page = 1, pageSize = 20, currency?: LedgerFilter): Promise<LedgerPageDto> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (currency) query.set('currency', currency);
    return this.invokeServiceCall(null, `users/${userId}/transactions?${query.toString()}`, Controllers.Currency, HttpMethod.Get);
  }

  // ===== Staff =====

  /** The balance event log: every player's ledger rows, filtered, sorted and paged by the server. */
  getLedger(query: LedgerQuery): Promise<LedgerPageDto> {
    return this.invokeServiceCall(null, `admin/ledger?${ledgerQueryString(query)}`, Controllers.Currency, HttpMethod.Get);
  }

  getTransaction(publicId: string): Promise<CurrencyTransactionDetailDto> {
    return this.invokeServiceCall(null, `admin/transactions/${encodeURIComponent(publicId)}`, Controllers.Currency, HttpMethod.Get);
  }

  reverse(publicId: string, note: string, allowPartial: boolean): Promise<ReversalResultDto> {
    return this.invokeServiceCall({ note, allowPartial }, `admin/transactions/${encodeURIComponent(publicId)}/reverse`,
      Controllers.Currency, HttpMethod.Post);
  }

  adjust(request: AdminAdjustmentDto, idempotencyKey: string): Promise<BalanceAdjustmentResultDto> {
    return this.invokeServiceCall(request, 'admin/adjustments', Controllers.Currency, HttpMethod.Post,
      { 'Idempotency-Key': idempotencyKey });
  }

  getTransferLock(userId: number): Promise<TransferLockDto> {
    return this.invokeServiceCall(null, `admin/users/${userId}/transfer-lock`, Controllers.Currency, HttpMethod.Get);
  }

  lockTransfers(userId: number, reason: string): Promise<TransferLockDto> {
    return this.invokeServiceCall({ reason }, `admin/users/${userId}/transfer-lock`, Controllers.Currency, HttpMethod.Put);
  }

  unlockTransfers(userId: number): Promise<TransferLockDto> {
    return this.invokeServiceCall(null, `admin/users/${userId}/transfer-lock`, Controllers.Currency, HttpMethod.Delete);
  }

  getPolicies(): Promise<CurrencyPolicyDto[]> {
    return this.invokeServiceCall(null, 'admin/policy', Controllers.Currency, HttpMethod.Get);
  }

  updatePolicy(currency: 'coins' | 'gems', policy: CurrencyPolicyDto): Promise<CurrencyPolicyDto> {
    return this.invokeServiceCall(policy, `admin/policy/${currency}`, Controllers.Currency, HttpMethod.Put);
  }

  // ===== Currency monitor (Phase 5) =====

  /** Anomaly alerts, newest first, with the open counts per severity. */
  getAlerts(query: CurrencyAlertQuery): Promise<CurrencyAlertPageDto> {
    return this.invokeServiceCall(null, `admin/alerts?${ledgerQueryString(query)}`, Controllers.Currency, HttpMethod.Get);
  }

  /** Marks the alert handled by the logged-in staff member (repeatable). */
  acknowledgeAlert(alertId: number): Promise<CurrencyAlertDto> {
    return this.invokeServiceCall(null, `admin/alerts/${alertId}/ack`, Controllers.Currency, HttpMethod.Post);
  }

  /** The last reconciliation run since the API started. */
  getReconciliation(): Promise<CurrencyReconciliationStatusDto> {
    return this.invokeServiceCall(null, 'admin/reconciliation', Controllers.Currency, HttpMethod.Get);
  }

  /** Runs the reconciliation now (409 while one is running). Report only - nothing is corrected. */
  runReconciliation(): Promise<CurrencyReconciliationRunDto> {
    return this.invokeServiceCall(null, 'admin/reconciliation/run', Controllers.Currency, HttpMethod.Post);
  }
}

/** The query string of GET admin/ledger (and admin/alerts): empty values are left out. */
export function ledgerQueryString(query: LedgerQuery | CurrencyAlertQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value).trim());
    }
  });
  return params.toString();
}

export const currencyClient = CurrencyClient.getInstance();
