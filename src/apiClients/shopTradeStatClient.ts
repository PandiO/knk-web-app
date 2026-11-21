import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    ShopTradeStatDto,
    ShopTradeStatListDto,
    ShopTradeStatRebuildDto,
    ShopTradeStatRebuildResultDto,
} from '../types/dtos/production/ShopDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 9.1): hourly trade stats (api/ShopTradeStats),
// one row per shop, blueprint and UTC hour, rolled up from the stock and currency ledger. Read only; `rebuild`
// recomputes a range (World area).
export class ShopTradeStatClient extends ObjectManager {
    private static instance: ShopTradeStatClient;

    public static getInstance() {
        if (!ShopTradeStatClient.instance) {
            ShopTradeStatClient.instance = new ShopTradeStatClient();
            ShopTradeStatClient.instance.logger = logging.getLogger('ShopTradeStatClient');
        }
        return ShopTradeStatClient.instance;
    }

    getById(id: number): Promise<ShopTradeStatDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopTradeStats, HttpMethod.Get);
    }

    /** The dashboard's search. Filters: `shopId`, `itemBlueprintId`, `from`, `to` (ISO UTC times on the hour). */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ShopTradeStatListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ShopTradeStats, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`, at most 200 rows) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ShopTradeStatListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ShopTradeStats, HttpMethod.Post);
    }

    /** Recomputes the hours of a range from the ledger (idempotent per shop and hour). */
    rebuild(data: ShopTradeStatRebuildDto): Promise<ShopTradeStatRebuildResultDto> {
        return this.invokeServiceCall(data, 'rebuild', Controllers.ShopTradeStats, HttpMethod.Post);
    }
}

export const shopTradeStatClient = ShopTradeStatClient.getInstance();
