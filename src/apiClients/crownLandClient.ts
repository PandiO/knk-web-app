import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { CrownLandDto, CrownLandListDto } from '../types/dtos/territory/TerritoryDtos';

// Territory V1 (PandiO/knk-workspace#326 API, #690 web app): crown land (a domain held by a kingdom, G10) CRUD + search (api/CrownLands).
export class CrownLandClient extends ObjectManager {
    private static instance: CrownLandClient;

    public static getInstance() {
        if (!CrownLandClient.instance) {
            CrownLandClient.instance = new CrownLandClient();
            CrownLandClient.instance.logger = logging.getLogger('CrownLandClient');
        }
        return CrownLandClient.instance;
    }

    getAll(): Promise<CrownLandDto[]> {
        return this.invokeServiceCall(null, '', Controllers.CrownLands, HttpMethod.Get);
    }

    getById(id: number): Promise<CrownLandDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.CrownLands, HttpMethod.Get);
    }

    create(data: CrownLandDto): Promise<CrownLandDto> {
        return this.invokeServiceCall(data, '', Controllers.CrownLands, HttpMethod.Post);
    }

    update(data: CrownLandDto): Promise<CrownLandDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.CrownLands, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.CrownLands, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<CrownLandListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.CrownLands, HttpMethod.Post);
    }
}

export const crownLandClient = CrownLandClient.getInstance();
