import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionWorldListDto } from '../types/dtos/structure/ProductionWorldDtos';
import { ShopDto, ShopOfferDto } from '../types/dtos/production/ShopDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 2, § 9): shops (api/Shops), a production
// structure underneath (its production view, lines and consumer view work on a shop), with the live offer. Buying and
// selling (quote, purchase, sell-quote, sell) take the plugin key only, so the web app does not call them.
export class ShopClient extends ObjectManager {
    private static instance: ShopClient;

    public static getInstance() {
        if (!ShopClient.instance) {
            ShopClient.instance = new ShopClient();
            ShopClient.instance.logger = logging.getLogger('ShopClient');
        }
        return ShopClient.instance;
    }

    getById(id: number): Promise<ShopDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Shops, HttpMethod.Get);
    }

    create(data: ShopDto): Promise<ShopDto> {
        return this.invokeServiceCall(data, '', Controllers.Shops, HttpMethod.Post);
    }

    update(data: ShopDto): Promise<ShopDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Shops, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Shops, HttpMethod.Delete);
    }

    /** The dashboard's search. Filters: `shopTypeId`, `kind`, `townId`, `districtId`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionWorldListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Shops, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionWorldListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.Shops, HttpMethod.Post);
    }

    /** What the shop offers now: its catalogue and Merchandise stock, each with price and stock (sold out greyed). */
    getOffer(id: number): Promise<ShopOfferDto> {
        return this.invokeServiceCall(null, `${id}/offer`, Controllers.Shops, HttpMethod.Get);
    }
}

export const shopClient = ShopClient.getInstance();
