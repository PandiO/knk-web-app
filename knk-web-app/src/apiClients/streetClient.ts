import { logging, Controllers, HttpMethod, StreetsOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../utils/domain/dto/common/PagedQuery";
import { StreetDto, StreetCreateDto, StreetUpdateDto } from "../utils/domain/dto/street/StreetDto";
import { ObjectManager } from "./objectManager";

export class StreetClient extends ObjectManager {
    private static instance: StreetClient;

    public static getInstance() {
        if (!StreetClient.instance) {
            StreetClient.instance = new StreetClient();
            StreetClient.instance.logger = logging.getLogger('StreetClient');
        }
        return StreetClient.instance;
    }

    getAll(): Promise<StreetDto[]> {
        return this.invokeServiceCall(null, StreetsOperation.GetAll, Controllers.Streets, HttpMethod.Get);
    }

    getById(id: number): Promise<StreetDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Streets, HttpMethod.Get);
    }

    create(data: StreetCreateDto): Promise<StreetDto> {
        return this.invokeServiceCall(data, StreetsOperation.Create, Controllers.Streets, HttpMethod.Post);
    }

    update(data: StreetUpdateDto): Promise<StreetDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Streets, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Streets, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<StreetDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Streets, HttpMethod.Post);
    }
}

export const streetClient = StreetClient.getInstance();
