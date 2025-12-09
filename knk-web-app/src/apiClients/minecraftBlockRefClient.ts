import { logging, Controllers, HttpMethod, MinecraftBlockRefOperation } from '../utils';
import { PagedQueryDto, PagedResultDto } from '../utils/domain/dto/common/PagedQuery';
import { ObjectManager } from './objectManager';
import {
    MinecraftBlockRefDto,
    MinecraftBlockRefCreateDto,
    MinecraftBlockRefUpdateDto,
    MinecraftBlockRefListDto
} from '../utils/domain/dto/minecraftBlockRef/MinecraftBlockRefDto';

export class MinecraftBlockRefClient extends ObjectManager {
    private static instance: MinecraftBlockRefClient;

    public static getInstance() {
        if (!MinecraftBlockRefClient.instance) {
            MinecraftBlockRefClient.instance = new MinecraftBlockRefClient();
            MinecraftBlockRefClient.instance.logger = logging.getLogger('MinecraftBlockRefClient');
        }
        return MinecraftBlockRefClient.instance;
    }

    getAll(): Promise<MinecraftBlockRefListDto[]> {
        return this.invokeServiceCall(null, MinecraftBlockRefOperation.GetAll, Controllers.MinecraftBlockRefs, HttpMethod.Get);
    }

    getById(id: number): Promise<MinecraftBlockRefDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.MinecraftBlockRefs, HttpMethod.Get);
    }

    create(data: MinecraftBlockRefCreateDto): Promise<MinecraftBlockRefDto> {
        return this.invokeServiceCall(data, MinecraftBlockRefOperation.Create, Controllers.MinecraftBlockRefs, HttpMethod.Post);
    }

    update(data: MinecraftBlockRefUpdateDto & { id: number }): Promise<MinecraftBlockRefDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.MinecraftBlockRefs, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.MinecraftBlockRefs, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<MinecraftBlockRefListDto>> {
        return this.invokeServiceCall(queryParams, MinecraftBlockRefOperation.SearchPaged, Controllers.MinecraftBlockRefs, HttpMethod.Post);
    }
}

export const minecraftBlockRefClient = MinecraftBlockRefClient.getInstance();
