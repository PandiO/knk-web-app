import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionYieldOverrideDto, ProductionYieldOverrideListDto } from '../types/dtos/production/ProductionYieldDtos';

// Yield areas P4 (PandiO/knk-workspace#138 API, #680 web app): Hybrid overrides (api/ProductionYieldOverrides): Pin,
// Exclude or Scale, one per output and structure; a change re-makes the structure's lines.
export class ProductionYieldOverrideClient extends ObjectManager {
    private static instance: ProductionYieldOverrideClient;

    public static getInstance() {
        if (!ProductionYieldOverrideClient.instance) {
            ProductionYieldOverrideClient.instance = new ProductionYieldOverrideClient();
            ProductionYieldOverrideClient.instance.logger = logging.getLogger('ProductionYieldOverrideClient');
        }
        return ProductionYieldOverrideClient.instance;
    }

    getAll(): Promise<ProductionYieldOverrideDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionYieldOverrides, HttpMethod.Get);
    }

    getById(id: number): Promise<ProductionYieldOverrideDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionYieldOverrides, HttpMethod.Get);
    }

    create(data: ProductionYieldOverrideDto): Promise<ProductionYieldOverrideDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionYieldOverrides, HttpMethod.Post);
    }

    update(data: ProductionYieldOverrideDto): Promise<ProductionYieldOverrideDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionYieldOverrides, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionYieldOverrides, HttpMethod.Delete);
    }

    /** Filters: `productionStructureId`, `itemBlueprintId`, `kind`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionYieldOverrideListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionYieldOverrides, HttpMethod.Post);
    }

    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionYieldOverrideListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionYieldOverrides, HttpMethod.Post);
    }
}

export const productionYieldOverrideClient = ProductionYieldOverrideClient.getInstance();
