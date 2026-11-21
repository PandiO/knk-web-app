import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import {
    ConsumerReplenishmentDto,
    ConsumerReplenishmentListDto,
} from '../types/dtos/production/LogisticsDtos';

// Town logistics P9 (PandiO/knk-workspace#127 API, #686 web app; TOWN_LOGISTICS § 3): a consumer storage's min
// (reorder point), max (target level) and priority class per blueprint (api/ConsumerReplenishments). One per storage and
// blueprint (409), Input or Merchandise storages only (400). Writes need knk.admin.world.
export class ConsumerReplenishmentClient extends ObjectManager {
    private static instance: ConsumerReplenishmentClient;

    public static getInstance() {
        if (!ConsumerReplenishmentClient.instance) {
            ConsumerReplenishmentClient.instance = new ConsumerReplenishmentClient();
            ConsumerReplenishmentClient.instance.logger = logging.getLogger('ConsumerReplenishmentClient');
        }
        return ConsumerReplenishmentClient.instance;
    }

    /** One record. */
    getById(id: number): Promise<ConsumerReplenishmentDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ConsumerReplenishments, HttpMethod.Get);
    }

    /** Filters: `storageId`, `structureId`, `townId`, `itemBlueprintId`, `enabled`; the term is a structure or blueprint name. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ConsumerReplenishmentListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ConsumerReplenishments, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ConsumerReplenishmentListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ConsumerReplenishments, HttpMethod.Post);
    }

    create(data: ConsumerReplenishmentDto): Promise<ConsumerReplenishmentDto> {
        return this.invokeServiceCall(data, '', Controllers.ConsumerReplenishments, HttpMethod.Post);
    }

    update(data: ConsumerReplenishmentDto): Promise<ConsumerReplenishmentDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ConsumerReplenishments, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ConsumerReplenishments, HttpMethod.Delete);
    }

}

export const consumerReplenishmentClient = ConsumerReplenishmentClient.getInstance();
