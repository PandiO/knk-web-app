import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ProvinceDto, ProvinceListDto } from '../types/dtos/territory/TerritoryDtos';

// Territory V1 (PandiO/knk-workspace#326 API, #690 web app): province CRUD + search (api/Provinces).
export class ProvinceClient extends ObjectManager {
    private static instance: ProvinceClient;

    public static getInstance() {
        if (!ProvinceClient.instance) {
            ProvinceClient.instance = new ProvinceClient();
            ProvinceClient.instance.logger = logging.getLogger('ProvinceClient');
        }
        return ProvinceClient.instance;
    }

    getAll(): Promise<ProvinceDto[]> {
        return this.invokeServiceCall(null, '', Controllers.Provinces, HttpMethod.Get);
    }

    getById(id: number): Promise<ProvinceDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Provinces, HttpMethod.Get);
    }

    create(data: ProvinceDto): Promise<ProvinceDto> {
        return this.invokeServiceCall(data, '', Controllers.Provinces, HttpMethod.Post);
    }

    update(data: ProvinceDto): Promise<ProvinceDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Provinces, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Provinces, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProvinceListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Provinces, HttpMethod.Post);
    }
}

export const provinceClient = ProvinceClient.getInstance();
