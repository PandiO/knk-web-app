import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ShopCatalogueEntryDto, ShopCatalogueEntryListDto } from '../types/dtos/production/ShopDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 2.3, § 4): a shop's static catalogue
// (api/ShopCatalogueEntries): a blueprint or one unique item, a static price (0: the formula), Stocked or Unlimited, a pin.
export class ShopCatalogueEntryClient extends ObjectManager {
    private static instance: ShopCatalogueEntryClient;

    public static getInstance() {
        if (!ShopCatalogueEntryClient.instance) {
            ShopCatalogueEntryClient.instance = new ShopCatalogueEntryClient();
            ShopCatalogueEntryClient.instance.logger = logging.getLogger('ShopCatalogueEntryClient');
        }
        return ShopCatalogueEntryClient.instance;
    }

    getById(id: number): Promise<ShopCatalogueEntryDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopCatalogueEntries, HttpMethod.Get);
    }

    create(data: ShopCatalogueEntryDto): Promise<ShopCatalogueEntryDto> {
        return this.invokeServiceCall(data, '', Controllers.ShopCatalogueEntries, HttpMethod.Post);
    }

    update(data: ShopCatalogueEntryDto): Promise<ShopCatalogueEntryDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ShopCatalogueEntries, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ShopCatalogueEntries, HttpMethod.Delete);
    }

    /** The dashboard's search. Filters: `shopId`, `itemBlueprintId`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ShopCatalogueEntryListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ShopCatalogueEntries, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ShopCatalogueEntryListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ShopCatalogueEntries, HttpMethod.Post);
    }
}

export const shopCatalogueEntryClient = ShopCatalogueEntryClient.getInstance();
