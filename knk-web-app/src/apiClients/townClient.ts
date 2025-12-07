import { logging, Controllers, HttpMethod, DominionOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../utils/domain/dto/common/PagedQuery";
import { TownDto, TownCreateDto, TownUpdateDto } from "../utils/domain/dto/town/TownDto";
import { ObjectManager } from "./objectManager";

export class TownClient extends ObjectManager {
    private static instance: TownClient;

    public static getInstance() {
        if (!TownClient.instance) {
            TownClient.instance = new TownClient();
            TownClient.instance.logger = logging.getLogger('TownClient');
        }
        return TownClient.instance;
    }

    getAll(): Promise<TownDto[]> {
        return this.invokeServiceCall(null, DominionOperation.GetAll, Controllers.Towns, HttpMethod.Get);
    }

    getById(id: number): Promise<TownDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Towns, HttpMethod.Get);
    }

    create(data: TownCreateDto): Promise<TownDto> {
        return this.invokeServiceCall(data, DominionOperation.GetAll, Controllers.Towns, HttpMethod.Post);
    }

    update(data: TownUpdateDto): Promise<TownDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Towns, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Towns, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<TownDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Towns, HttpMethod.Post);
    }
}

export const townClient = TownClient.getInstance();
