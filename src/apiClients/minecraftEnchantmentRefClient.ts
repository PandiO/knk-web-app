import { logging, Controllers, HttpMethod, MinecraftEnchantmentRefOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import { ObjectManager } from "./objectManager";
import {
    MinecraftEnchantmentRefDto,
    MinecraftEnchantmentRefCreateDto,
    MinecraftEnchantmentRefUpdateDto,
    MinecraftEnchantmentRefListDto
} from "../types/dtos/minecraftEnchantmentRef/MinecraftEnchantmentRefDto";
import { MinecraftHybridEnchantmentOptionDto } from "../types/dtos/minecraftEnchantmentRef/MinecraftHybridEnchantmentOptionDto";

export class MinecraftEnchantmentRefClient extends ObjectManager {
    private static instance: MinecraftEnchantmentRefClient;

    public static getInstance() {
        if (!MinecraftEnchantmentRefClient.instance) {
            MinecraftEnchantmentRefClient.instance = new MinecraftEnchantmentRefClient();
            MinecraftEnchantmentRefClient.instance.logger = logging.getLogger('MinecraftEnchantmentRefClient');
        }
        return MinecraftEnchantmentRefClient.instance;
    }

    getAll(): Promise<MinecraftEnchantmentRefListDto[]> {
        return this.invokeServiceCall(null, MinecraftEnchantmentRefOperation.GetAll, Controllers.MinecraftEnchantmentRefs, HttpMethod.Get);
    }

    getById(id: number): Promise<MinecraftEnchantmentRefDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.MinecraftEnchantmentRefs, HttpMethod.Get);
    }

    getHybrid(search?: string, category?: string, take?: number): Promise<MinecraftHybridEnchantmentOptionDto[]> {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (take) params.append('take', take.toString());

        const endpoint = `hybrid${params.toString() ? '?' + params.toString() : ''}`;
        return this.invokeServiceCall(null, endpoint, Controllers.MinecraftEnchantmentRefs, HttpMethod.Get);
    }

    create(data: MinecraftEnchantmentRefCreateDto): Promise<MinecraftEnchantmentRefDto> {
        return this.invokeServiceCall(data, MinecraftEnchantmentRefOperation.Create, Controllers.MinecraftEnchantmentRefs, HttpMethod.Post);
    }

    persistFromCatalog(namespaceKey: string, category?: string, legacyName?: string): Promise<MinecraftEnchantmentRefDto> {
        return this.invokeServiceCall(
            { namespaceKey, category, legacyName },
            'get-or-create',
            Controllers.MinecraftEnchantmentRefs,
            HttpMethod.Post
        );
    }

    update(data: MinecraftEnchantmentRefUpdateDto & { id: number }): Promise<MinecraftEnchantmentRefDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.MinecraftEnchantmentRefs, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.MinecraftEnchantmentRefs, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<MinecraftEnchantmentRefListDto>> {
        return this.invokeServiceCall(queryParams, MinecraftEnchantmentRefOperation.SearchPaged, Controllers.MinecraftEnchantmentRefs, HttpMethod.Post);
    }
}

export const minecraftEnchantmentRefClient = MinecraftEnchantmentRefClient.getInstance();
