import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    LogisticsPlannerRunDto,
    LogisticsPlannerRunListDto,
} from '../types/dtos/production/LogisticsDtos';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS § 5): stored planner runs
// (api/LogisticsPlannerRuns), read only, with their plan explanation (lines at or above their min are not stored).
export class LogisticsPlannerRunClient extends ObjectManager {
    private static instance: LogisticsPlannerRunClient;

    public static getInstance() {
        if (!LogisticsPlannerRunClient.instance) {
            LogisticsPlannerRunClient.instance = new LogisticsPlannerRunClient();
            LogisticsPlannerRunClient.instance.logger = logging.getLogger('LogisticsPlannerRunClient');
        }
        return LogisticsPlannerRunClient.instance;
    }

    /** A run with its entries. */
    getById(id: number): Promise<LogisticsPlannerRunDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LogisticsPlannerRuns, HttpMethod.Get);
    }

    /** Newest first. Filters: `townId`, `trigger`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<LogisticsPlannerRunListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LogisticsPlannerRuns, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<LogisticsPlannerRunListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.LogisticsPlannerRuns, HttpMethod.Post);
    }

}

export const logisticsPlannerRunClient = LogisticsPlannerRunClient.getInstance();
