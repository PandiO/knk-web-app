import { logging, Controllers, HttpMethod, MinecraftMaterialRefOperation } from '../utils';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ObjectManager } from './objectManager';
import {
    MinecraftMaterialRefDto,
    MinecraftMaterialRefCreateDto,
    MinecraftMaterialRefUpdateDto,
    MinecraftMaterialRefListDto
} from '../types/dtos/minecraftMaterialRef/MinecraftMaterialRefDto';
import { MinecraftHybridMaterialOptionDto } from '../types/dtos/minecraftMaterialRef/MinecraftHybridMaterialOptionDto';

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

    getHybrid(search?: string, category?: string, take?: number): Promise<MinecraftHybridMaterialOptionDto[]> {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (take) params.append('take', take.toString());

        const endpoint = `hybrid${params.toString() ? '?' + params.toString() : ''}`;
        return this.invokeServiceCall(null, endpoint, Controllers.MinecraftMaterialRefs, HttpMethod.Get);
    }

    create(data: MinecraftMaterialRefCreateDto): Promise<MinecraftMaterialRefDto> {
        return this.invokeServiceCall(data, MinecraftMaterialRefOperation.Create, Controllers.MinecraftMaterialRefs, HttpMethod.Post);
    }

    persistFromCatalog(namespaceKey: string, category?: string, legacyName?: string): Promise<MinecraftMaterialRefDto> {
        return this.invokeServiceCall(
            { namespaceKey, category, legacyName },
            'get-or-create',
            Controllers.MinecraftMaterialRefs,
            HttpMethod.Post
        );
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
}

export const minecraftMaterialRefClient = MinecraftMaterialRefClient.getInstance();



