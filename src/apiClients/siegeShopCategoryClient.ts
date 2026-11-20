import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { SiegeShopCategoryDto } from '../types/dtos/siege/SiegeShopDtos';

// Siege shop (PandiO/knk-workspace#867): shop category CRUD + search.
export class SiegeShopCategoryClient extends ObjectManager {
    private static instance: SiegeShopCategoryClient;

    public static getInstance() {
        if (!SiegeShopCategoryClient.instance) {
            SiegeShopCategoryClient.instance = new SiegeShopCategoryClient();
            SiegeShopCategoryClient.instance.logger = logging.getLogger('SiegeShopCategoryClient');
        }
        return SiegeShopCategoryClient.instance;
    }

    getAll(): Promise<SiegeShopCategoryDto[]> {
        return this.invokeServiceCall(null, '', Controllers.SiegeShopCategories, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeShopCategoryDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeShopCategories, HttpMethod.Get);
    }

    create(data: SiegeShopCategoryDto): Promise<SiegeShopCategoryDto> {
        return this.invokeServiceCall(data, '', Controllers.SiegeShopCategories, HttpMethod.Post);
    }

    update(data: SiegeShopCategoryDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeShopCategories, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeShopCategories, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeShopCategoryDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeShopCategories, HttpMethod.Post);
    }
}

export const siegeShopCategoryClient = SiegeShopCategoryClient.getInstance();
