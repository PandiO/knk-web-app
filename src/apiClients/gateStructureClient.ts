import { logging, Controllers, HttpMethod, GateStructuresOperation } from "../utils";
import { PagedQueryDto, PagedResultDto } from "../types/dtos/common/PagedQuery";
import {
    GateStateUpdateDto,
    GateStructureDto,
    GateStructureCreateDto,
    GateStructureUpdateDto,
    GateStructureListDto
} from "../types/dtos/gateStructure/GateStructureDto";
import { GateBlockSnapshotCreateDto, GateBlockSnapshotDto } from "../types/dtos/gateStructure/GateBlockSnapshotDto";
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

    updateState(id: number, request: GateStateUpdateDto): Promise<void> {
        return this.invokeServiceCall(request, `${id}/state`, Controllers.GateStructures, HttpMethod.Put);
    }

    getSnapshots(id: number): Promise<GateBlockSnapshotDto[]> {
        return this.invokeServiceCall(null, `${id}/snapshots`, Controllers.GateStructures, HttpMethod.Get);
    }

    addSnapshots(id: number, snapshots: GateBlockSnapshotCreateDto[]): Promise<void> {
        return this.invokeServiceCall(snapshots, `${id}/snapshots/bulk`, Controllers.GateStructures, HttpMethod.Post);
    }

    clearSnapshots(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}/snapshots`, Controllers.GateStructures, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<GateStructureListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.GateStructures, HttpMethod.Post);
    }
}

export const gateStructureClient = GateStructureClient.getInstance();
