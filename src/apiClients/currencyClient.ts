import { logging, Controllers, HttpMethod } from '../utils';
import { BalancesDto, LedgerPageDto } from '../types/dtos/currency/CurrencyDtos';
import { ObjectManager } from './objectManager';

/** 'coins' | 'gems' | 'xp' filter for the history, or undefined for all three. */
export type LedgerFilter = 'coins' | 'gems' | 'xp';

// knk-web-api api/currency (currency ledger, KNG-21 Phase 3). Read-only for web users: payments
// between players are in-game only (currency DESIGN.md §5 Q4), so there is no transfer call here.
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
}

export const currencyClient = CurrencyClient.getInstance();
