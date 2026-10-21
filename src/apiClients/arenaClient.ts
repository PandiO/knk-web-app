import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ArenaBattlegroundDto, ArenaDto, ArenaListDto, ArenaSpectatorAreaDto } from '../types/dtos/arena/ArenaDtos';

// Arena duels (KNG-210): arenas, battlegrounds and spectator areas all live under api/Arenas. The eligible kits
// travel in the arena payload as an M2M set (null keeps it, [] clears it).
export class ArenaClient extends ObjectManager {
    private static instance: ArenaClient;

    public static getInstance() {
        if (!ArenaClient.instance) {
            ArenaClient.instance = new ArenaClient();
            ArenaClient.instance.logger = logging.getLogger('ArenaClient');
        }
        return ArenaClient.instance;
    }

    getAll(): Promise<ArenaDto[]> {
        return this.invokeServiceCall(null, '', Controllers.Arenas, HttpMethod.Get);
    }

    getById(id: number): Promise<ArenaDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Arenas, HttpMethod.Get);
    }

    create(data: ArenaDto): Promise<ArenaDto> {
        return this.invokeServiceCall(data, '', Controllers.Arenas, HttpMethod.Post);
    }

    update(data: ArenaDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Arenas, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Arenas, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ArenaListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Arenas, HttpMethod.Post);
    }
}

export class ArenaBattlegroundClient extends ObjectManager {
    private static instance: ArenaBattlegroundClient;

    public static getInstance() {
        if (!ArenaBattlegroundClient.instance) {
            ArenaBattlegroundClient.instance = new ArenaBattlegroundClient();
            ArenaBattlegroundClient.instance.logger = logging.getLogger('ArenaBattlegroundClient');
        }
        return ArenaBattlegroundClient.instance;
    }

    getById(id: number): Promise<ArenaBattlegroundDto> {
        return this.invokeServiceCall(null, `battlegrounds/${id}`, Controllers.Arenas, HttpMethod.Get);
    }

    create(data: ArenaBattlegroundDto): Promise<ArenaBattlegroundDto> {
        return this.invokeServiceCall(data, 'battlegrounds', Controllers.Arenas, HttpMethod.Post);
    }

    update(data: ArenaBattlegroundDto): Promise<void> {
        return this.invokeServiceCall(data, `battlegrounds/${data.id}`, Controllers.Arenas, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `battlegrounds/${id}`, Controllers.Arenas, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ArenaBattlegroundDto>> {
        return this.invokeServiceCall(queryParams, 'battlegrounds/search', Controllers.Arenas, HttpMethod.Post);
    }
}

export class ArenaSpectatorAreaClient extends ObjectManager {
    private static instance: ArenaSpectatorAreaClient;

    public static getInstance() {
        if (!ArenaSpectatorAreaClient.instance) {
            ArenaSpectatorAreaClient.instance = new ArenaSpectatorAreaClient();
            ArenaSpectatorAreaClient.instance.logger = logging.getLogger('ArenaSpectatorAreaClient');
        }
        return ArenaSpectatorAreaClient.instance;
    }

    getById(id: number): Promise<ArenaSpectatorAreaDto> {
        return this.invokeServiceCall(null, `spectator-areas/${id}`, Controllers.Arenas, HttpMethod.Get);
    }

    create(data: ArenaSpectatorAreaDto): Promise<ArenaSpectatorAreaDto> {
        return this.invokeServiceCall(data, 'spectator-areas', Controllers.Arenas, HttpMethod.Post);
    }

    update(data: ArenaSpectatorAreaDto): Promise<void> {
        return this.invokeServiceCall(data, `spectator-areas/${data.id}`, Controllers.Arenas, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `spectator-areas/${id}`, Controllers.Arenas, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ArenaSpectatorAreaDto>> {
        return this.invokeServiceCall(queryParams, 'spectator-areas/search', Controllers.Arenas, HttpMethod.Post);
    }
}

export const arenaClient = ArenaClient.getInstance();
