import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ShopTypeLevelDto, ShopTypeLevelListDto } from '../types/dtos/production/ShopDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 5): a shop type's levels (api/ShopTypeLevels):
// speed, yield, input cost, price multiplier, storage caps and the default min/max. A save applies to the type's shops.
export class ShopTypeLevelClient extends ObjectManager {
    private static instance: ShopTypeLevelClient;

    public static getInstance() {
        if (!ShopTypeLevelClient.instance) {
            ShopTypeLevelClient.instance = new ShopTypeLevelClient();
            ShopTypeLevelClient.instance.logger = logging.getLogger('ShopTypeLevelClient');
        }
        return ShopTypeLevelClient.instance;
    }

    getById(id: number): Promise<ShopTypeLevelDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopTypeLevels, HttpMethod.Get);
    }

    create(data: ShopTypeLevelDto): Promise<ShopTypeLevelDto> {
        return this.invokeServiceCall(data, '', Controllers.ShopTypeLevels, HttpMethod.Post);
    }

    update(data: ShopTypeLevelDto): Promise<ShopTypeLevelDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ShopTypeLevels, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopTypeLevels, HttpMethod.Delete);
    }

    /** The dashboard's search. Filters: `shopTypeId`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ShopTypeLevelListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ShopTypeLevels, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ShopTypeLevelListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ShopTypeLevels, HttpMethod.Post);
    }
}

export const shopTypeLevelClient = ShopTypeLevelClient.getInstance();
