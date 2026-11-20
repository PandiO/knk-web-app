import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { TransportLaneDto, TransportLaneListDto } from '../types/dtos/production/TransportDtos';

// Transport core P5 (PandiO/knk-workspace#79 API, #682 web app; production DESIGN § 7.6): lanes (api/TransportLanes),
// the measured route between two structures. The game server measures them (P5b #681); staff can type one in with the
// seeded form. One lane per direction (409 for a second); delete also needs knk.admin.delete.
export class TransportLaneClient extends ObjectManager {
    private static instance: TransportLaneClient;

    public static getInstance() {
        if (!TransportLaneClient.instance) {
            TransportLaneClient.instance = new TransportLaneClient();
            TransportLaneClient.instance.logger = logging.getLogger('TransportLaneClient');
        }
        return TransportLaneClient.instance;
    }

    getById(id: number): Promise<TransportLaneDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TransportLanes, HttpMethod.Get);
    }

    create(data: TransportLaneDto): Promise<TransportLaneDto> {
        return this.invokeServiceCall(data, '', Controllers.TransportLanes, HttpMethod.Post);
    }

    update(data: TransportLaneDto): Promise<TransportLaneDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.TransportLanes, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TransportLanes, HttpMethod.Delete);
    }

    /** Newest measurement first. Filters: `fromStructureId`, `toStructureId`, `structureId` (either end), `source`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<TransportLaneListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.TransportLanes, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<TransportLaneListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.TransportLanes, HttpMethod.Post);
    }
}

export const transportLaneClient = TransportLaneClient.getInstance();
