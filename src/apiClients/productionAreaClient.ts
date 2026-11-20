import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    ProductionAreaDto,
    ProductionAreaListDto,
    ProductionAreaOverlapDto,
} from '../types/dtos/production/ProductionYieldDtos';

// Yield areas P4 (PandiO/knk-workspace#138 API, #680 web app): a production structure's areas (api/ProductionAreas).
// Create and update answer the area with `size`, `sizeUnit` and the level's `maxSize`; 400 over the cap (the message
// names the maximum), 409 when an exclusive area overlaps another exclusive area of the same model.
export class ProductionAreaClient extends ObjectManager {
    private static instance: ProductionAreaClient;

    public static getInstance() {
        if (!ProductionAreaClient.instance) {
            ProductionAreaClient.instance = new ProductionAreaClient();
            ProductionAreaClient.instance.logger = logging.getLogger('ProductionAreaClient');
        }
        return ProductionAreaClient.instance;
    }

    getAll(): Promise<ProductionAreaDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionAreas, HttpMethod.Get);
    }

    getById(id: number): Promise<ProductionAreaDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionAreas, HttpMethod.Get);
    }

    create(data: ProductionAreaDto): Promise<ProductionAreaDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionAreas, HttpMethod.Post);
    }

    /** Answers 200 with the area (size and cap included). */
    update(data: ProductionAreaDto): Promise<ProductionAreaDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionAreas, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionAreas, HttpMethod.Delete);
    }

    /** Filters: `productionStructureId`, `model`, `exclusive`, `enabled`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionAreaListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionAreas, HttpMethod.Post);
    }

    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionAreaListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionAreas, HttpMethod.Post);
    }

    /** The other areas whose bounding box overlaps this one. */
    getOverlaps(id: number): Promise<ProductionAreaOverlapDto[]> {
        return this.invokeServiceCall(null, `${id}/overlaps`, Controllers.ProductionAreas, HttpMethod.Get);
    }
}

export const productionAreaClient = ProductionAreaClient.getInstance();
