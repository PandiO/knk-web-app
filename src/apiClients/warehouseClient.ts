import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ProductionWorldListDto, WarehouseDto } from '../types/dtos/structure/ProductionWorldDtos';

// P2 world (PandiO/knk-workspace#91 API, #676 web app): warehouses (api/Warehouses), in a district or rural. The create
// answers the warehouse with its delivery storage and any placement warnings (`placementWarnings`).
export class WarehouseClient extends ObjectManager {
    private static instance: WarehouseClient;

    public static getInstance() {
        if (!WarehouseClient.instance) {
            WarehouseClient.instance = new WarehouseClient();
            WarehouseClient.instance.logger = logging.getLogger('WarehouseClient');
        }
        return WarehouseClient.instance;
    }

    getAll(): Promise<WarehouseDto[]> {
        return this.invokeServiceCall(null, '', Controllers.Warehouses, HttpMethod.Get);
    }

    /** With `storages`, `effectiveTownId` and `isRural`. */
    getById(id: number): Promise<WarehouseDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Warehouses, HttpMethod.Get);
    }

    create(data: WarehouseDto): Promise<WarehouseDto> {
        return this.invokeServiceCall(data, '', Controllers.Warehouses, HttpMethod.Post);
    }

    update(data: WarehouseDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Warehouses, HttpMethod.Put);
    }

    /** 409 while its storage holds stock or has ledger history. */
    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Warehouses, HttpMethod.Delete);
    }

    /** Filters: `districtId`, `townId` (effective), `isRural`, `territoryFlag`, `acceptsDeliveries`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionWorldListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Warehouses, HttpMethod.Post);
    }
}

export const warehouseClient = WarehouseClient.getInstance();
