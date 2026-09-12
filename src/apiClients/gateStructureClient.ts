import { logging, Controllers, HttpMethod, GateStructuresOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import {
    GateStructureDto,
    GateStructureCreateDto,
    GateStructureUpdateDto,
    GateStructureListDto
} from "../types/dtos/gateStructure/GateStructureDto";
import { GateStructureOverridesUpdateDto } from "../types/dtos/gateStructure/GateStructureOverridesUpdateDto";
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

    getById(id: number, includeSnapshots?: boolean): Promise<GateStructureDto> {
        const requestData = includeSnapshots ? { includeSnapshots: true } : null;
        return this.invokeServiceCall(requestData, `${id}`, Controllers.GateStructures, HttpMethod.Get);
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

    getByDomain(domainId: number): Promise<GateStructureDto[]> {
        return this.invokeServiceCall(null, `domain/${domainId}`, Controllers.GateStructures, HttpMethod.Get);
    }

    // Decision 5.0-B: sets/clears the structure-level cascading overrides - every overridable
    // door field that's non-null here wins over each child GateDoor's own value at read time,
    // with no per-door write needed. See GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md item 5.
    updateOverrides(id: number, request: GateStructureOverridesUpdateDto): Promise<void> {
        return this.invokeServiceCall(request, `${id}/overrides`, Controllers.GateStructures, HttpMethod.Patch);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<GateStructureListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.GateStructures, HttpMethod.Post);
    }
}

export const gateStructureClient = GateStructureClient.getInstance();
