import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionKindLevelDto, ProductionKindLevelListDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): a kind's levels (api/ProductionKindLevels): read and update only, every kind has levels 1-10. `items` (unlocks and
// upgrade cost) replaces the stored list when sent.
export class ProductionKindLevelClient extends ObjectManager {
    private static instance: ProductionKindLevelClient;

    public static getInstance() {
        if (!ProductionKindLevelClient.instance) {
            ProductionKindLevelClient.instance = new ProductionKindLevelClient();
            ProductionKindLevelClient.instance.logger = logging.getLogger('ProductionKindLevelClient');
        }
        return ProductionKindLevelClient.instance;
    }

    getAll(): Promise<ProductionKindLevelDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionKindLevels, HttpMethod.Get);
    }

    getById(id: number): Promise<ProductionKindLevelDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionKindLevels, HttpMethod.Get);
    }

    /** A null field keeps the stored value. */
    update(data: ProductionKindLevelDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionKindLevels, HttpMethod.Put);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionKindLevelListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionKindLevels, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionKindLevelListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionKindLevels, HttpMethod.Post);
    }
}

export const productionKindLevelClient = ProductionKindLevelClient.getInstance();
