import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { SiegeAmmoTypeDto, SiegeAmmoTypeListDto } from '../types/dtos/siege/SiegeWeaponDtos';

// Siege weapons phase 1 (PandiO/knk-workspace#782): ammo type CRUD + search.
export class SiegeAmmoTypeClient extends ObjectManager {
    private static instance: SiegeAmmoTypeClient;

    public static getInstance() {
        if (!SiegeAmmoTypeClient.instance) {
            SiegeAmmoTypeClient.instance = new SiegeAmmoTypeClient();
            SiegeAmmoTypeClient.instance.logger = logging.getLogger('SiegeAmmoTypeClient');
        }
        return SiegeAmmoTypeClient.instance;
    }

    getAll(): Promise<SiegeAmmoTypeDto[]> {
        return this.invokeServiceCall(null, '', Controllers.SiegeAmmoTypes, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeAmmoTypeDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeAmmoTypes, HttpMethod.Get);
    }

    create(data: SiegeAmmoTypeDto): Promise<SiegeAmmoTypeDto> {
        return this.invokeServiceCall(data, '', Controllers.SiegeAmmoTypes, HttpMethod.Post);
    }

    update(data: SiegeAmmoTypeDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeAmmoTypes, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeAmmoTypes, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeAmmoTypeListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeAmmoTypes, HttpMethod.Post);
    }
}

export const siegeAmmoTypeClient = SiegeAmmoTypeClient.getInstance();
