import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    TransportCancelDto,
    TransportOrderCreateDto,
    TransportOrderDto,
    TransportOrderListDto,
    TransportPlanDto,
    TransportSweepResultDto,
} from '../types/dtos/production/TransportDtos';

// Transport core P5 (PandiO/knk-workspace#79 API, #682 web app; production DESIGN § 7): transport orders
// (api/TransportOrders). Orders are written by the transport service only: a manual order is created (after a dry run),
// an order is cancelled; there is no edit or delete. Writes need knk.admin.world (or the plugin key).
export class TransportOrderClient extends ObjectManager {
    private static instance: TransportOrderClient;

    public static getInstance() {
        if (!TransportOrderClient.instance) {
            TransportOrderClient.instance = new TransportOrderClient();
            TransportOrderClient.instance.logger = logging.getLogger('TransportOrderClient');
        }
        return TransportOrderClient.instance;
    }

    /** With stops, lines, the cargo in transit, assignments and the event log. */
    getById(id: number): Promise<TransportOrderDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TransportOrders, HttpMethod.Get);
    }

    /** The dashboard table's search. Filters: `status` (a comma list), `origin`, `open`, `sourceStructureId`,
     *  `sourceStorageId`, `storageId` (source or any stop), `structureId` (source, stop or carrier); the term is an id. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<TransportOrderListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.TransportOrders, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<TransportOrderListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.TransportOrders, HttpMethod.Post);
    }

    /** A manual (or quest) order: 400 `{ error }` with the plan's errors; a repeated `clientKey` answers the first order. */
    create(data: TransportOrderCreateDto): Promise<TransportOrderDto> {
        return this.invokeServiceCall(data, '', Controllers.TransportOrders, HttpMethod.Post);
    }

    /** What the order would do (lines, availability, legs, carrier, warnings and errors), without writing anything. */
    dryRun(data: TransportOrderCreateDto): Promise<TransportPlanDto> {
        return this.invokeServiceCall(data, 'dry-run', Controllers.TransportOrders, HttpMethod.Post);
    }

    /** Before loading the order ends Cancelled; a loaded order turns back and ends Returned. 409 when it is final or
     *  already returning. */
    cancel(id: number, data: TransportCancelDto = {}): Promise<TransportOrderDto> {
        return this.invokeServiceCall(data, `${id}/cancel`, Controllers.TransportOrders, HttpMethod.Post);
    }

    /** One transport sweep over every open order and the automatic trigger; 409 while production is off. */
    runNow(): Promise<TransportSweepResultDto> {
        return this.invokeServiceCall(null, 'run-now', Controllers.TransportOrders, HttpMethod.Post);
    }
}

export const transportOrderClient = TransportOrderClient.getInstance();
