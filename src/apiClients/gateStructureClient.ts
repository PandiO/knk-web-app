import { logging, Controllers, HttpMethod, GateStructuresOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import { GateStructureDto, GateStructureCreateDto, GateStructureUpdateDto, GateStructureListDto } from "../types/dtos/gateStructure/GateStructureDto";
import { ObjectManager } from "./objectManager";

export class GateStructureClient extends ObjectManager {
    private static instance: GateStructureClient;

    public static getInstance() {
        if (!GateStructureClient.instance) {
            GateStructureClient.instance = new GateStructureClient();
            GateStructureClient.instance.logger = logging.getLogger('GateStructureClient');
        }
        return GateStructureClient.instance;
    }

    getAll(): Promise<GateStructureDto[]> {
        return this.invokeServiceCall(null, GateStructuresOperation.GetAll, Controllers.GateStructures, HttpMethod.Get);
    }

    getById(id: number): Promise<GateStructureDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.GateStructures, HttpMethod.Get);
    }

    create(data: GateStructureCreateDto): Promise<GateStructureDto> {
        return this.invokeServiceCall(data, GateStructuresOperation.GetAll, Controllers.GateStructures, HttpMethod.Post);
    }

    update(data: GateStructureUpdateDto): Promise<GateStructureDto> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.GateStructures, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.GateStructures, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<GateStructureListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.GateStructures, HttpMethod.Post);
    }
}
