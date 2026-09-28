import { logging, Controllers, HttpMethod } from '../utils';
import {
  RoadEdgeDto,
  RoadEdgeSearchQuery,
  RoadEdgeUpdateDto,
  RoadEdgeUpdateResultDto,
  RoadNetworkMetaDto,
  RoadNodeDto,
  RoadNodeUpdateDto,
  RoadPagedResultDto,
  RoadProfileDto,
  RoadProfileUpsertDto,
  RoadTileDto,
  RoadTileGraphDto,
  StreetRoadDto,
} from '../types/dtos/road/RoadDtos';
import { ObjectManager } from './objectManager';

// docs/specs/navigation/DESIGN.md §3.8 / IMPLEMENTATION_PLAN.md Phase 1.5 route table. Reads are
// anonymous; writes need knk.admin.road (ROAD_ADMIN_NODE) - the API answers 401/403 otherwise.
// Errors come back as { error: "ValidationFailed" | "NotFound" | "Conflict", message } and
// serviceCall turns `message` into the thrown Error's text (with `status`).
export class RoadClient extends ObjectManager {
  private static instance: RoadClient;

  public static getInstance() {
    if (!RoadClient.instance) {
      RoadClient.instance = new RoadClient();
      RoadClient.instance.logger = logging.getLogger('RoadClient');
    }
    return RoadClient.instance;
  }

  // ===== Profiles (api/road-profiles)

  getProfiles(): Promise<RoadProfileDto[]> {
    return this.invokeServiceCall(null, '', Controllers.RoadProfiles, HttpMethod.Get);
  }

  getProfile(id: number): Promise<RoadProfileDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.RoadProfiles, HttpMethod.Get);
  }

  createProfile(profile: RoadProfileUpsertDto): Promise<RoadProfileDto> {
    return this.invokeServiceCall(profile, '', Controllers.RoadProfiles, HttpMethod.Post);
  }

  /** Send `stats: null` to keep the stored survey statistics (plan D5). */
  updateProfile(id: number, profile: RoadProfileUpsertDto): Promise<RoadProfileDto> {
    return this.invokeServiceCall(profile, `${id}`, Controllers.RoadProfiles, HttpMethod.Put);
  }

  deleteProfile(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.RoadProfiles, HttpMethod.Delete);
  }

  // ===== Tiles (api/road-tiles)

  getTiles(world: string): Promise<RoadTileDto[]> {
    return this.invokeServiceCall({ world }, '', Controllers.RoadTiles, HttpMethod.Get);
  }

  getTileGraph(world: string, tileX: number, tileZ: number): Promise<RoadTileGraphDto> {
    return this.invokeServiceCall(null, `${encodeURIComponent(world)}/${tileX}/${tileZ}/graph`, Controllers.RoadTiles, HttpMethod.Get);
  }

  // ===== Network (api/road-network)

  getMeta(world: string): Promise<RoadNetworkMetaDto> {
    return this.invokeServiceCall({ world }, 'meta', Controllers.RoadNetwork, HttpMethod.Get);
  }

  // ===== Edges (api/road-edges)

  /** Server-paged; filters world, tileId, streetId, unlabelled, stale; sortBy id | length | streetId | tileId. */
  searchEdges(query: RoadEdgeSearchQuery): Promise<RoadPagedResultDto<RoadEdgeDto>> {
    return this.invokeServiceCall(query, 'search', Controllers.RoadEdges, HttpMethod.Post);
  }

  /** With `propagate: true` the result lists every edge the street change reached. */
  updateEdge(id: number, update: RoadEdgeUpdateDto): Promise<RoadEdgeUpdateResultDto> {
    return this.invokeServiceCall(update, `${id}`, Controllers.RoadEdges, HttpMethod.Put);
  }

  deleteEdge(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.RoadEdges, HttpMethod.Delete);
  }

  // ===== Nodes (api/road-nodes)

  /** Locks the node unless `locked: false` is part of the update. */
  updateNode(id: number, update: RoadNodeUpdateDto): Promise<RoadNodeDto> {
    return this.invokeServiceCall(update, `${id}`, Controllers.RoadNodes, HttpMethod.Put);
  }

  // ===== Streets (api/Streets/{id}/road)

  getStreetRoad(streetId: number): Promise<StreetRoadDto> {
    return this.invokeServiceCall(null, `${streetId}/road`, Controllers.Streets, HttpMethod.Get);
  }
}

export const roadClient = RoadClient.getInstance();
