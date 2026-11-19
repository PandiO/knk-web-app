import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import {
    ProductionStructureDto,
    ProductionWorldListDto,
    RoadConnectionUpdateDto,
} from '../types/dtos/structure/ProductionWorldDtos';

// P2 world (PandiO/knk-workspace#91 API, #676 web app): production structures (api/ProductionStructures), mostly rural.
// The create answers the structure with its output storage and any placement warnings (`placementWarnings`); a read
// carries the dashboard `warnings` (contested, outside territory, not connected to the roads).
export class ProductionStructureClient extends ObjectManager {
    private static instance: ProductionStructureClient;

    public static getInstance() {
        if (!ProductionStructureClient.instance) {
            ProductionStructureClient.instance = new ProductionStructureClient();
            ProductionStructureClient.instance.logger = logging.getLogger('ProductionStructureClient');
        }
        return ProductionStructureClient.instance;
    }

    getAll(): Promise<ProductionStructureDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionStructures, HttpMethod.Get);
    }

    /** With `storages`, `warnings`, `effectiveTownId` and `isRural`. */
    getById(id: number): Promise<ProductionStructureDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionStructures, HttpMethod.Get);
    }

    create(data: ProductionStructureDto): Promise<ProductionStructureDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionStructures, HttpMethod.Post);
    }

    update(data: ProductionStructureDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionStructures, HttpMethod.Put);
    }

    /** 409 while one of its storages holds stock or has ledger history. */
    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionStructures, HttpMethod.Delete);
    }

    /** Filters: `districtId`, `townId` (effective), `isRural`, `territoryFlag`, `productionKindId`, `roadConnection`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionWorldListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionStructures, HttpMethod.Post);
    }

    /** The road connection the game server measured (plugin key or knk.admin.world). */
    setRoadConnection(id: number, data: RoadConnectionUpdateDto): Promise<ProductionStructureDto> {
        return this.invokeServiceCall(data, `${id}/road-connection`, Controllers.ProductionStructures, HttpMethod.Put);
    }
}

export const productionStructureClient = ProductionStructureClient.getInstance();
