import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    LogisticsReleaseDto,
    LogisticsReservationDto,
    LogisticsReservationListDto,
} from '../types/dtos/production/LogisticsDtos';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS § 5.1): reservations of warehouse
// stock for a consumer storage (api/LogisticsReservations), made by the planner only. Staff can release an open one
// before its collection order loads (409 once loaded).
export class LogisticsReservationClient extends ObjectManager {
    private static instance: LogisticsReservationClient;

    public static getInstance() {
        if (!LogisticsReservationClient.instance) {
            LogisticsReservationClient.instance = new LogisticsReservationClient();
            LogisticsReservationClient.instance.logger = logging.getLogger('LogisticsReservationClient');
        }
        return LogisticsReservationClient.instance;
    }

    /** With its explanation and the collection order. */
    getById(id: number): Promise<LogisticsReservationDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LogisticsReservations, HttpMethod.Get);
    }

    /** Filters: `townId`, `warehouseId`, `consumerStructureId`, `status`, `open`, `transportOrderId`, `plannerRunId`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<LogisticsReservationListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LogisticsReservations, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<LogisticsReservationListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.LogisticsReservations, HttpMethod.Post);
    }

    /** Ends an open reservation Cancelled with its collection order; 409 once loaded or already closed. */
    release(id: number, data: LogisticsReleaseDto = {}): Promise<LogisticsReservationDto> {
        return this.invokeServiceCall(data, `${id}/release`, Controllers.LogisticsReservations, HttpMethod.Post);
    }

}

export const logisticsReservationClient = LogisticsReservationClient.getInstance();
