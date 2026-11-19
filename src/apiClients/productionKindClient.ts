import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionKindDto, ProductionKindListDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): production kinds (api/ProductionKinds). A kind is created with its ten levels and reads with them in `levels`.
export class ProductionKindClient extends ObjectManager {
    private static instance: ProductionKindClient;

    public static getInstance() {
        if (!ProductionKindClient.instance) {
            ProductionKindClient.instance = new ProductionKindClient();
            ProductionKindClient.instance.logger = logging.getLogger('ProductionKindClient');
        }
        return ProductionKindClient.instance;
    }

    getAll(): Promise<ProductionKindDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionKinds, HttpMethod.Get);
    }

    getById(id: number): Promise<ProductionKindDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionKinds, HttpMethod.Get);
    }

    create(data: ProductionKindDto): Promise<ProductionKindDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionKinds, HttpMethod.Post);
    }

    /** A null field keeps the stored value. */
    update(data: ProductionKindDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionKinds, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionKinds, HttpMethod.Delete);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionKindListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionKinds, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionKindListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionKinds, HttpMethod.Post);
    }
}

export const productionKindClient = ProductionKindClient.getInstance();
