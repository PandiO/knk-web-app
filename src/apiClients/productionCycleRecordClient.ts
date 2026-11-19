import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionCycleRecordDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): the cycle trace (api/ProductionCycleRecords, read only): one record per settle that accrued or changed status,
// with each applied modifier. Filters: `productionStructureId`, `productionLineId`; newest first.
export class ProductionCycleRecordClient extends ObjectManager {
    private static instance: ProductionCycleRecordClient;

    public static getInstance() {
        if (!ProductionCycleRecordClient.instance) {
            ProductionCycleRecordClient.instance = new ProductionCycleRecordClient();
            ProductionCycleRecordClient.instance.logger = logging.getLogger('ProductionCycleRecordClient');
        }
        return ProductionCycleRecordClient.instance;
    }

    getById(id: number): Promise<ProductionCycleRecordDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionCycleRecords, HttpMethod.Get);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionCycleRecordDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionCycleRecords, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionCycleRecordDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionCycleRecords, HttpMethod.Post);
    }
}

export const productionCycleRecordClient = ProductionCycleRecordClient.getInstance();
