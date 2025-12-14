import { logging, Controllers, HttpMethod, StructuresOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import { StructureDto, StructureCreateDto, StructureUpdateDto } from "../types/dtos/structure/StructureDto";
import { ObjectManager } from "./objectManager";

export class StructureClient extends ObjectManager {
    private static instance: StructureClient;

    public static getInstance() {
        if (!StructureClient.instance) {
            StructureClient.instance = new StructureClient();
            StructureClient.instance.logger = logging.getLogger('StructureClient');
        }
        return StructureClient.instance;
    }

    getAll(): Promise<StructureDto[]> {
        return this.invokeServiceCall(null, StructuresOperation.GetAll, Controllers.Structures, HttpMethod.Get);
    }

    getById(id: number): Promise<StructureDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Structures, HttpMethod.Get);
    }

    create(data: StructureCreateDto): Promise<StructureDto> {
        return this.invokeServiceCall(data, StructuresOperation.Create, Controllers.Structures, HttpMethod.Post);
    }

    update(data: StructureUpdateDto): Promise<StructureDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Structures, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Structures, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<StructureDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.Structures, HttpMethod.Post);
    }
}

export const structureClient = StructureClient.getInstance();


