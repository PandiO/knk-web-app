import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { SiegeLobbyDto, SiegeLobbyListDto } from '../types/dtos/siege/SiegeDtos';

// Siege Phase 3 (DESIGN.md §3.8): lobby CRUD + search; the rotation travels in this payload as an
// M2M set (null keeps it, [] clears it).
export class SiegeLobbyClient extends ObjectManager {
    private static instance: SiegeLobbyClient;

    public static getInstance() {
        if (!SiegeLobbyClient.instance) {
            SiegeLobbyClient.instance = new SiegeLobbyClient();
            SiegeLobbyClient.instance.logger = logging.getLogger('SiegeLobbyClient');
        }
        return SiegeLobbyClient.instance;
    }

    getAll(): Promise<SiegeLobbyListDto[]> {
        return this.invokeServiceCall(null, '', Controllers.SiegeLobbies, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeLobbyDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeLobbies, HttpMethod.Get);
    }

    create(data: SiegeLobbyDto): Promise<SiegeLobbyDto> {
        return this.invokeServiceCall(data, '', Controllers.SiegeLobbies, HttpMethod.Post);
    }

    update(data: SiegeLobbyDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeLobbies, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeLobbies, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeLobbyListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeLobbies, HttpMethod.Post);
    }
}

export const siegeLobbyClient = SiegeLobbyClient.getInstance();
