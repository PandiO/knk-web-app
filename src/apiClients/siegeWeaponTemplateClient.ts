import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { SiegeWeaponTemplateDto, SiegeWeaponTemplateListDto } from '../types/dtos/siege/SiegeWeaponDtos';

// Siege weapons phase 1 (PandiO/knk-workspace#782): weapon template CRUD + search; the allowed ammo types travel in
// this payload as an M2M set (null keeps it, [] clears it).
export class SiegeWeaponTemplateClient extends ObjectManager {
    private static instance: SiegeWeaponTemplateClient;

    public static getInstance() {
        if (!SiegeWeaponTemplateClient.instance) {
            SiegeWeaponTemplateClient.instance = new SiegeWeaponTemplateClient();
            SiegeWeaponTemplateClient.instance.logger = logging.getLogger('SiegeWeaponTemplateClient');
        }
        return SiegeWeaponTemplateClient.instance;
    }

    getAll(): Promise<SiegeWeaponTemplateDto[]> {
        return this.invokeServiceCall(null, '', Controllers.SiegeWeaponTemplates, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeWeaponTemplateDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeWeaponTemplates, HttpMethod.Get);
    }

    create(data: SiegeWeaponTemplateDto): Promise<SiegeWeaponTemplateDto> {
        return this.invokeServiceCall(data, '', Controllers.SiegeWeaponTemplates, HttpMethod.Post);
    }

    update(data: SiegeWeaponTemplateDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeWeaponTemplates, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeWeaponTemplates, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeWeaponTemplateListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeWeaponTemplates, HttpMethod.Post);
    }
}

export const siegeWeaponTemplateClient = SiegeWeaponTemplateClient.getInstance();
