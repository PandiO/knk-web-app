import { logging, Controllers, HttpMethod } from "../utils";
import {
    GateDoorDto,
    GateDoorStateUpdateDto,
    GateDoorHealthUpdateDto,
    GateDoorOperationalSettingsUpdateDto
} from "../types/dtos/gateStructure/GateDoorDto";
import { GateBlockSnapshotCreateDto, GateBlockSnapshotDto } from "../types/dtos/gateStructure/GateBlockSnapshotDto";
import { ObjectManager } from "./objectManager";
import { findValueByFieldName } from "../utils/fieldNameMapper";

// GateDoorClient - introduced by item 5's multi-door support (see
// docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md). Listing and
// creation are scoped under the parent GateStructure; individual door operations address the
// door directly by its own id, mirroring GateStructureClient's shape.
export class GateDoorClient extends ObjectManager {
    private static instance: GateDoorClient;

    public static getInstance() {
        if (!GateDoorClient.instance) {
            GateDoorClient.instance = new GateDoorClient();
            GateDoorClient.instance.logger = logging.getLogger('GateDoorClient');
        }
        return GateDoorClient.instance;
    }

    getByStructureId(gateStructureId: number): Promise<GateDoorDto[]> {
        return this.invokeServiceCall(null, `${gateStructureId}/doors`, Controllers.GateStructures, HttpMethod.Get);
    }

    getById(id: number, includeSnapshots?: boolean): Promise<GateDoorDto> {
        const requestData = includeSnapshots ? { includeSnapshots: true } : null;
        return this.invokeServiceCall(requestData, `${id}`, Controllers.GateDoors, HttpMethod.Get);
    }

    create(data: GateDoorDto): Promise<GateDoorDto> {
        // Case-insensitive lookup: the dynamic FormConfiguration-driven wizard submits fields
        // keyed by their authored FormField.fieldName (PascalCase, e.g. "GateStructureId"),
        // while GateDoorDto (matching the API's own camelCase wire format) declares
        // "gateStructureId". Every other client just forwards its payload straight through and
        // lets the backend's case-insensitive JSON binding sort it out server-side - this is the
        // only client that needs to read a field out of the payload on the frontend itself, to
        // build the nested URL.
        const gateStructureId = findValueByFieldName(data as unknown as Record<string, unknown>, 'gateStructureId');
        return this.invokeServiceCall(data, `${gateStructureId}/doors`, Controllers.GateStructures, HttpMethod.Post);
    }

    update(data: GateDoorDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.GateDoors, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.GateDoors, HttpMethod.Delete);
    }

    updateState(id: number, request: GateDoorStateUpdateDto): Promise<void> {
        return this.invokeServiceCall(request, `${id}/state`, Controllers.GateDoors, HttpMethod.Put);
    }

    updateHealth(id: number, request: GateDoorHealthUpdateDto): Promise<void> {
        return this.invokeServiceCall(request, `${id}/health`, Controllers.GateDoors, HttpMethod.Put);
    }

    updateOperationalSettings(id: number, request: GateDoorOperationalSettingsUpdateDto): Promise<void> {
        return this.invokeServiceCall(request, `${id}/operational-settings`, Controllers.GateDoors, HttpMethod.Put);
    }

    getSnapshots(id: number): Promise<GateBlockSnapshotDto[]> {
        return this.invokeServiceCall(null, `${id}/snapshots`, Controllers.GateDoors, HttpMethod.Get);
    }

    addSnapshots(id: number, snapshots: GateBlockSnapshotCreateDto[]): Promise<void> {
        return this.invokeServiceCall(snapshots, `${id}/snapshots/bulk`, Controllers.GateDoors, HttpMethod.Post);
    }

    clearSnapshots(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}/snapshots`, Controllers.GateDoors, HttpMethod.Delete);
    }

    getOpenedSnapshots(id: number): Promise<GateBlockSnapshotDto[]> {
        return this.invokeServiceCall(null, `${id}/openedSnapshots`, Controllers.GateDoors, HttpMethod.Get);
    }

    addOpenedSnapshots(id: number, snapshots: GateBlockSnapshotCreateDto[]): Promise<void> {
        return this.invokeServiceCall(snapshots, `${id}/openedSnapshots/bulk`, Controllers.GateDoors, HttpMethod.Post);
    }

    clearOpenedSnapshots(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}/openedSnapshots`, Controllers.GateDoors, HttpMethod.Delete);
    }
}

export const gateDoorClient = GateDoorClient.getInstance();
