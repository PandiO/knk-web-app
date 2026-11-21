import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ShopTypeDto, ShopTypeListDto } from '../types/dtos/production/ShopDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 2.1, § 3.2, § 5): shop types (api/ShopTypes)
// with their accepted categories (`acceptedCategoryIds`, the whole list) and levels. World area; delete also knk.admin.delete.
export class ShopTypeClient extends ObjectManager {
    private static instance: ShopTypeClient;

    public static getInstance() {
        if (!ShopTypeClient.instance) {
            ShopTypeClient.instance = new ShopTypeClient();
            ShopTypeClient.instance.logger = logging.getLogger('ShopTypeClient');
        }
        return ShopTypeClient.instance;
    }

    getById(id: number): Promise<ShopTypeDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopTypes, HttpMethod.Get);
    }

    create(data: ShopTypeDto): Promise<ShopTypeDto> {
        return this.invokeServiceCall(data, '', Controllers.ShopTypes, HttpMethod.Post);
    }

    update(data: ShopTypeDto): Promise<ShopTypeDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ShopTypes, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopTypes, HttpMethod.Delete);
    }

    /** The dashboard's search. Filters: `isActive`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ShopTypeListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ShopTypes, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ShopTypeListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ShopTypes, HttpMethod.Post);
    }
}

export const shopTypeClient = ShopTypeClient.getInstance();
