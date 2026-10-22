import { logging, Controllers, HttpMethod, MinecraftMaterialRefOperation } from '../utils';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ObjectManager } from './objectManager';
import {
    MinecraftMaterialRefDto,
    MinecraftMaterialRefCreateDto,
    MinecraftMaterialRefUpdateDto,
    MinecraftMaterialRefListDto
} from '../types/dtos/minecraftMaterialRef/MinecraftMaterialRefDto';

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

    /**
     * `POST api/MinecraftMaterialRefs/get-or-create`: the saved row for the key (normalised by the
     * API), or a new Unverified row with this category when the catalogue doesn't have it yet.
     */
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



