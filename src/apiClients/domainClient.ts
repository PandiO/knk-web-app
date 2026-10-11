import { logging, Controllers, HttpMethod, DomainOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { DomainDto } from "../types/dtos/domain/DomainDtos";
import { DomainWorldMissingDto, DomainWorldResolutionDto, DomainWorldResolveRequestDto } from "../types/dtos/domain/DomainWorldDtos";
import { ObjectManager } from "./objectManager";

export class DomainClient extends ObjectManager {
    private static instance: DomainClient;

    public static getInstance() {
        if (!DomainClient.instance) {
            DomainClient.instance = new DomainClient();
            DomainClient.instance.logger = logging.getLogger('DomainClient');
        }
        return DomainClient.instance;
    }

    getAll(): Promise<DomainDto[]> {
        return this.invokeServiceCall(null, DomainOperation.GetAll, Controllers.Domains, HttpMethod.Get);
    }

    getById(id: string): Promise<DomainDto> {
        return this.invokeServiceCall(null, `${DomainOperation.GetById}${id}`, Controllers.Domains, HttpMethod.Get);
    }

    public create(data: DomainDto): Promise<DomainDto> {
        return this.invokeServiceCall(data, DomainOperation.Create, Controllers.Domains, HttpMethod.Post);
    }

    public update(data: DomainDto): Promise<DomainDto> {
        if (!data.id) {
            throw new Error('DomainDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Domains, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.Domains, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, DomainOperation.SearchPaged, Controllers.Domains, HttpMethod.Post);
    }

    /** KNG-111: the world a domain being saved would get, or that the form has to ask for it. */
    public resolveWorld(request: DomainWorldResolveRequestDto): Promise<DomainWorldResolutionDto> {
        return this.invokeServiceCall(request, 'world/resolve', Controllers.Domains, HttpMethod.Post);
    }

    /** KNG-111: domains created before worlds were stored that still have none. */
    public getWithoutWorld(): Promise<DomainWorldMissingDto[]> {
        return this.invokeServiceCall(null, 'world/missing', Controllers.Domains, HttpMethod.Get);
    }
}
