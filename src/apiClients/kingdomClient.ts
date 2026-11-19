import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { KingdomDto, KingdomListDto } from '../types/dtos/territory/TerritoryDtos';

// Territory V1 (PandiO/knk-workspace#326 API, #690 web app): kingdom CRUD + search (api/Kingdoms).
export class KingdomClient extends ObjectManager {
    private static instance: KingdomClient;

    public static getInstance() {
        if (!KingdomClient.instance) {
            KingdomClient.instance = new KingdomClient();
            KingdomClient.instance.logger = logging.getLogger('KingdomClient');
        }
        return KingdomClient.instance;
    }

    getAll(): Promise<KingdomDto[]> {
        return this.invokeServiceCall(null, '', Controllers.Kingdoms, HttpMethod.Get);
    }

    getById(id: number): Promise<KingdomDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Kingdoms, HttpMethod.Get);
    }

    create(data: KingdomDto): Promise<KingdomDto> {
        return this.invokeServiceCall(data, '', Controllers.Kingdoms, HttpMethod.Post);
    }

    update(data: KingdomDto): Promise<KingdomDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Kingdoms, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Kingdoms, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<KingdomListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Kingdoms, HttpMethod.Post);
    }
}

export const kingdomClient = KingdomClient.getInstance();
