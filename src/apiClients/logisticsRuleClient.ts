import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    LogisticsRuleDto,
    LogisticsRuleListDto,
} from '../types/dtos/production/LogisticsDtos';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app): the rules of every policy version
// (api/LogisticsRules), read only: rules are edited as a whole list on their policy (a new version).
export class LogisticsRuleClient extends ObjectManager {
    private static instance: LogisticsRuleClient;

    public static getInstance() {
        if (!LogisticsRuleClient.instance) {
            LogisticsRuleClient.instance = new LogisticsRuleClient();
            LogisticsRuleClient.instance.logger = logging.getLogger('LogisticsRuleClient');
        }
        return LogisticsRuleClient.instance;
    }

    /** One record. */
    getById(id: number): Promise<LogisticsRuleDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LogisticsRules, HttpMethod.Get);
    }

    /** Rules with their policy version. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<LogisticsRuleListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LogisticsRules, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<LogisticsRuleListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.LogisticsRules, HttpMethod.Post);
    }

}

export const logisticsRuleClient = LogisticsRuleClient.getInstance();
