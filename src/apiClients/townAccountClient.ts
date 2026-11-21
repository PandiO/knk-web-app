import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { TownAccountDto, TownAccountEntryDto, TownAccountListDto } from '../types/dtos/production/ShopDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 3.1, F2): a town's account
// (api/TownAccounts), where shop income goes and buy-backs are paid from. Read only; balances change only through the
// currency ledger.
export class TownAccountClient extends ObjectManager {
    private static instance: TownAccountClient;

    public static getInstance() {
        if (!TownAccountClient.instance) {
            TownAccountClient.instance = new TownAccountClient();
            TownAccountClient.instance.logger = logging.getLogger('TownAccountClient');
        }
        return TownAccountClient.instance;
    }

    getById(id: number): Promise<TownAccountDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TownAccounts, HttpMethod.Get);
    }

    /** The town's account; 404 while the town has none (no shop income yet). */
    getByTown(townId: number): Promise<TownAccountDto> {
        return this.invokeServiceCall(null, `by-town/${townId}`, Controllers.TownAccounts, HttpMethod.Get);
    }

    /** The dashboard's search. Filter: `townId`; the search term matches the town's name. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<TownAccountListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.TownAccounts, HttpMethod.Post);
    }

    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<TownAccountListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.TownAccounts, HttpMethod.Post);
    }

    /** The account's town legs, newest first. */
    ledger(id: number, pageNumber = 1, pageSize = 50): Promise<StockPagedResultDto<TownAccountEntryDto>> {
        return this.invokeServiceCall(null, `${id}/ledger?pageNumber=${pageNumber}&pageSize=${pageSize}`, Controllers.TownAccounts, HttpMethod.Get);
    }
}

export const townAccountClient = TownAccountClient.getInstance();
