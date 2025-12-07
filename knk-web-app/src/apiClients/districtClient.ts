import { logging, Controllers, HttpMethod, DistrictsOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../utils/domain/dto/common/PagedQuery";
import { DistrictDto, DistrictCreateDto, DistrictUpdateDto } from "../utils/domain/dto/district/DistrictDto";
import { ObjectManager } from "./objectManager";

export class DistrictClient extends ObjectManager {
    private static instance: DistrictClient;

    public static getInstance() {
        if (!DistrictClient.instance) {
            DistrictClient.instance = new DistrictClient();
            DistrictClient.instance.logger = logging.getLogger('DistrictClient');
        }
        return DistrictClient.instance;
    }

    getAll(): Promise<DistrictDto[]> {
        return this.invokeServiceCall(null, DistrictsOperation.GetAll, Controllers.Districts, HttpMethod.Get);
    }

    getById(id: number): Promise<DistrictDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Districts, HttpMethod.Get);
    }

    create(data: DistrictCreateDto): Promise<DistrictDto> {
        return this.invokeServiceCall(data, DistrictsOperation.GetAll, Controllers.Districts, HttpMethod.Post);
    }

    update(data: DistrictUpdateDto): Promise<DistrictDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Districts, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Districts, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<DistrictDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Districts, HttpMethod.Post);
    }
}

export const districtClient = DistrictClient.getInstance();
