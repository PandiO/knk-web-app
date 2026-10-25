import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ArenaAreaDto, ArenaAreaRegionDto, ArenaDto, ArenaListDto } from '../types/dtos/arena/ArenaDtos';

// Arena duels (KNG-210): arenas and (rev. 6) their areas and the areas' regions all live under api/Arenas. The
// eligible kits travel in the arena payload as an M2M set (null keeps it, [] clears it).
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

/** Rev. 6: battlegrounds, spectator areas and the lobby (api/Arenas/areas). */
export class ArenaAreaClient extends ObjectManager {
    private static instance: ArenaAreaClient;

    public static getInstance() {
        if (!ArenaAreaClient.instance) {
            ArenaAreaClient.instance = new ArenaAreaClient();
            ArenaAreaClient.instance.logger = logging.getLogger('ArenaAreaClient');
        }
        return ArenaAreaClient.instance;
    }

    getById(id: number): Promise<ArenaAreaDto> {
        return this.invokeServiceCall(null, `areas/${id}`, Controllers.Arenas, HttpMethod.Get);
    }

    create(data: ArenaAreaDto): Promise<ArenaAreaDto> {
        return this.invokeServiceCall(data, 'areas', Controllers.Arenas, HttpMethod.Post);
    }

    update(data: ArenaAreaDto): Promise<ArenaAreaDto> {
        return this.invokeServiceCall(data, `areas/${data.id}`, Controllers.Arenas, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `areas/${id}`, Controllers.Arenas, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ArenaAreaDto>> {
        return this.invokeServiceCall(queryParams, 'areas/search', Controllers.Arenas, HttpMethod.Post);
    }
}

/** Rev. 6: the regions of an arena area (api/Arenas/areas/regions), renamed on save by the API. */
export class ArenaAreaRegionClient extends ObjectManager {
    private static instance: ArenaAreaRegionClient;

    public static getInstance() {
        if (!ArenaAreaRegionClient.instance) {
            ArenaAreaRegionClient.instance = new ArenaAreaRegionClient();
            ArenaAreaRegionClient.instance.logger = logging.getLogger('ArenaAreaRegionClient');
        }
        return ArenaAreaRegionClient.instance;
    }

    getById(id: number): Promise<ArenaAreaRegionDto> {
        return this.invokeServiceCall(null, `areas/regions/${id}`, Controllers.Arenas, HttpMethod.Get);
    }

    create(data: ArenaAreaRegionDto): Promise<ArenaAreaRegionDto> {
        return this.invokeServiceCall(data, 'areas/regions', Controllers.Arenas, HttpMethod.Post);
    }

    update(data: ArenaAreaRegionDto): Promise<ArenaAreaRegionDto> {
        return this.invokeServiceCall(data, `areas/regions/${data.id}`, Controllers.Arenas, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `areas/regions/${id}`, Controllers.Arenas, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ArenaAreaRegionDto>> {
        return this.invokeServiceCall(queryParams, 'areas/regions/search', Controllers.Arenas, HttpMethod.Post);
    }
}

export const arenaClient = ArenaClient.getInstance();
