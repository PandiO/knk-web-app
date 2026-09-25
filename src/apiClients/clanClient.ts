import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ClanDto, ClanListDto } from '../types/dtos/clan/ClanDtos';

// Siege Phase 1 (docs/specs/siege-minigame/DESIGN.md §3.2): minimal clan identity.
export class ClanClient extends ObjectManager {
    private static instance: ClanClient;

    public static getInstance() {
        if (!ClanClient.instance) {
            ClanClient.instance = new ClanClient();
            ClanClient.instance.logger = logging.getLogger('ClanClient');
        }
        return ClanClient.instance;
    }

    getAll(): Promise<ClanDto[]> {
        return this.invokeServiceCall(null, '', Controllers.Clans, HttpMethod.Get);
    }

    getById(id: number): Promise<ClanDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Clans, HttpMethod.Get);
    }

    getDefaultForTown(townId: number): Promise<ClanDto> {
        return this.invokeServiceCall(null, `default-for-town/${townId}`, Controllers.Clans, HttpMethod.Get);
    }

    create(data: ClanDto): Promise<ClanDto> {
        return this.invokeServiceCall(data, '', Controllers.Clans, HttpMethod.Post);
    }

    update(data: ClanDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Clans, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Clans, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ClanListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Clans, HttpMethod.Post);
    }
}

export const clanClient = ClanClient.getInstance();
