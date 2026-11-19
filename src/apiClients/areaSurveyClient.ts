import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { AreaSurveyDto, AreaSurveyListDto, AreaSurveyTrendDto } from '../types/dtos/production/ProductionYieldDtos';

// Yield areas P4 (PandiO/knk-workspace#138 API, #680 web app): the survey history (api/AreaSurveys, read only; the game
// server posts surveys to api/ProductionAreas/{id}/surveys).
export class AreaSurveyClient extends ObjectManager {
    private static instance: AreaSurveyClient;

    public static getInstance() {
        if (!AreaSurveyClient.instance) {
            AreaSurveyClient.instance = new AreaSurveyClient();
            AreaSurveyClient.instance.logger = logging.getLogger('AreaSurveyClient');
        }
        return AreaSurveyClient.instance;
    }

    /** With its units. */
    getById(id: number): Promise<AreaSurveyDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.AreaSurveys, HttpMethod.Get);
    }

    /** Filters: `productionAreaId`, `productionStructureId`, `trigger`; newest first. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<AreaSurveyListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.AreaSurveys, HttpMethod.Post);
    }

    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<AreaSurveyListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.AreaSurveys, HttpMethod.Post);
    }

    /** Each unit key's count over the area's last `take` surveys, oldest first. */
    getTrend(productionAreaId: number, take = 30): Promise<AreaSurveyTrendDto> {
        return this.invokeServiceCall(null, `trend?productionAreaId=${productionAreaId}&take=${take}`, Controllers.AreaSurveys, HttpMethod.Get);
    }
}

export const areaSurveyClient = AreaSurveyClient.getInstance();
