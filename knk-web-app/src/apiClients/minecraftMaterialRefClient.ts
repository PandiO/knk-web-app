import { logging, Controllers, HttpMethod, MinecraftMaterialRefOperation } from '../utils';
import { PagedQueryDto, PagedResultDto } from '../utils/domain/dto/common/PagedQuery';
import { ObjectManager } from './objectManager';
import {
    MinecraftMaterialRefDto,
    MinecraftMaterialRefCreateDto,
    MinecraftMaterialRefUpdateDto,
    MinecraftMaterialRefListDto
} from '../utils/domain/dto/minecraftMaterialRef/MinecraftMaterialRefDto';
import { MinecraftHybridMaterialOptionDto } from '../utils/domain/dto/minecraftMaterialRef/MinecraftHybridMaterialOptionDto';

export class MinecraftMaterialRefClient extends ObjectManager {
    private static instance: MinecraftMaterialRefClient;

    public static getInstance() {
        if (!MinecraftMaterialRefClient.instance) {
            MinecraftMaterialRefClient.instance = new MinecraftMaterialRefClient();
            MinecraftMaterialRefClient.instance.logger = logging.getLogger('MinecraftMaterialRefClient');
        }
        return MinecraftMaterialRefClient.instance;
    }

    getAll(): Promise<MinecraftMaterialRefListDto[]> {
        return this.invokeServiceCall(null, MinecraftMaterialRefOperation.GetAll, Controllers.MinecraftMaterialRefs, HttpMethod.Get);
    }

    getById(id: number): Promise<MinecraftMaterialRefDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.MinecraftMaterialRefs, HttpMethod.Get);
    }

    create(data: MinecraftMaterialRefCreateDto): Promise<MinecraftMaterialRefDto> {
        return this.invokeServiceCall(data, MinecraftMaterialRefOperation.Create, Controllers.MinecraftMaterialRefs, HttpMethod.Post);
    }

    update(data: MinecraftMaterialRefUpdateDto & { id: number }): Promise<MinecraftMaterialRefDto> {
        return this.invokeServiceCall(data, `${(data as any).id ?? ''}`, Controllers.MinecraftMaterialRefs, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.MinecraftMaterialRefs, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<MinecraftMaterialRefListDto>> {
        return this.invokeServiceCall(queryParams, MinecraftMaterialRefOperation.SearchPaged, Controllers.MinecraftMaterialRefs, HttpMethod.Post);
    }

    getHybridOptions(params?: { search?: string; category?: string; take?: number }): Promise<MinecraftHybridMaterialOptionDto[]> {
        return this.invokeServiceCall(params ?? null, 'hybrid', Controllers.MinecraftMaterialRefs, HttpMethod.Get);
    }
}

export const minecraftMaterialRefClient = MinecraftMaterialRefClient.getInstance();
