import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionLineDto, ProductionLineListDto, ProductionSettleResultDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): production lines (api/ProductionLines). `inputs` replaces the stored list when sent; status and accrual are read only.
export class ProductionLineClient extends ObjectManager {
    private static instance: ProductionLineClient;

    public static getInstance() {
        if (!ProductionLineClient.instance) {
            ProductionLineClient.instance = new ProductionLineClient();
            ProductionLineClient.instance.logger = logging.getLogger('ProductionLineClient');
        }
        return ProductionLineClient.instance;
    }

    getAll(): Promise<ProductionLineDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionLines, HttpMethod.Get);
    }

    getById(id: number): Promise<ProductionLineDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionLines, HttpMethod.Get);
    }

    create(data: ProductionLineDto): Promise<ProductionLineDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionLines, HttpMethod.Post);
    }

    /** A null field keeps the stored value. */
    update(data: ProductionLineDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionLines, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionLines, HttpMethod.Delete);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionLineListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionLines, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionLineListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionLines, HttpMethod.Post);
    }

    /** Settles the line up to now: 409 while `Production:Enabled` is off. */
    settle(id: number): Promise<ProductionSettleResultDto> {
        return this.invokeServiceCall(null, `${id}/settle`, Controllers.ProductionLines, HttpMethod.Post);
    }
}

export const productionLineClient = ProductionLineClient.getInstance();
