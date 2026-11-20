import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { SiegeShopEntryDto, SiegeShopEntryListDto } from '../types/dtos/siege/SiegeShopDtos';

// Siege shop (PandiO/knk-workspace#867): shop entry CRUD + search, the modes' default lists and scenario-only entries.
export class SiegeShopEntryClient extends ObjectManager {
    private static instance: SiegeShopEntryClient;

    public static getInstance() {
        if (!SiegeShopEntryClient.instance) {
            SiegeShopEntryClient.instance = new SiegeShopEntryClient();
            SiegeShopEntryClient.instance.logger = logging.getLogger('SiegeShopEntryClient');
        }
        return SiegeShopEntryClient.instance;
    }

    getAll(): Promise<SiegeShopEntryDto[]> {
        return this.invokeServiceCall(null, '', Controllers.SiegeShopEntries, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeShopEntryDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeShopEntries, HttpMethod.Get);
    }

    create(data: SiegeShopEntryDto): Promise<SiegeShopEntryDto> {
        return this.invokeServiceCall(data, '', Controllers.SiegeShopEntries, HttpMethod.Post);
    }

    update(data: SiegeShopEntryDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeShopEntries, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeShopEntries, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeShopEntryListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeShopEntries, HttpMethod.Post);
    }
}

export const siegeShopEntryClient = SiegeShopEntryClient.getInstance();
