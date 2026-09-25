import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { findValueByFieldName } from '../utils/fieldNameMapper';
import { SiegeTeamDto } from '../types/dtos/siege/SiegeDtos';

// Siege Phase 3 (DESIGN.md §3.4): a team is created under its scenario
// (POST /api/SiegeScenarios/{id}/teams), otherwise addressed by its own id - BannerLayerClient's shape.
// The wizard submits authored field names ("SiegeScenarioId"), so the parent id is read
// case-insensitively to build the nested URL (same reason as GateDoorClient.create).
export class SiegeTeamClient extends ObjectManager {
    private static instance: SiegeTeamClient;

    public static getInstance() {
        if (!SiegeTeamClient.instance) {
            SiegeTeamClient.instance = new SiegeTeamClient();
            SiegeTeamClient.instance.logger = logging.getLogger('SiegeTeamClient');
        }
        return SiegeTeamClient.instance;
    }

    getById(id: number): Promise<SiegeTeamDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeTeams, HttpMethod.Get);
    }

    create(data: SiegeTeamDto): Promise<SiegeTeamDto> {
        const siegeScenarioId = findValueByFieldName(data as unknown as Record<string, unknown>, 'siegeScenarioId');
        return this.invokeServiceCall(data, `${siegeScenarioId}/teams`, Controllers.SiegeScenarios, HttpMethod.Post);
    }

    update(data: SiegeTeamDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeTeams, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeTeams, HttpMethod.Delete);
    }

    // filters: { siegeScenarioId: "<id>" } scopes it to one scenario (holder/owner pickers).
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeTeamDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeTeams, HttpMethod.Post);
    }
}

export const siegeTeamClient = SiegeTeamClient.getInstance();
