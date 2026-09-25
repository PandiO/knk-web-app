import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { SiegeScenarioDto, SiegeScenarioListDto, SiegeScenarioReadinessDto } from '../types/dtos/siege/SiegeDtos';

// Siege Phase 3 (docs/specs/siege-minigame/DESIGN.md §3.3): scenario CRUD + search, and the §3.9
// readiness check. Teams/objectives are owned children with their own clients; the scenario's own
// create/update ignores them, while districts/gates travel in this payload as M2M sets.
export class SiegeScenarioClient extends ObjectManager {
    private static instance: SiegeScenarioClient;

    public static getInstance() {
        if (!SiegeScenarioClient.instance) {
            SiegeScenarioClient.instance = new SiegeScenarioClient();
            SiegeScenarioClient.instance.logger = logging.getLogger('SiegeScenarioClient');
        }
        return SiegeScenarioClient.instance;
    }

    getAll(): Promise<SiegeScenarioListDto[]> {
        return this.invokeServiceCall(null, '', Controllers.SiegeScenarios, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeScenarioDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeScenarios, HttpMethod.Get);
    }

    getReadiness(id: number): Promise<SiegeScenarioReadinessDto> {
        return this.invokeServiceCall(null, `${id}/readiness`, Controllers.SiegeScenarios, HttpMethod.Get);
    }

    create(data: SiegeScenarioDto): Promise<SiegeScenarioDto> {
        return this.invokeServiceCall(data, '', Controllers.SiegeScenarios, HttpMethod.Post);
    }

    update(data: SiegeScenarioDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeScenarios, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeScenarios, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<SiegeScenarioListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.SiegeScenarios, HttpMethod.Post);
    }
}

export const siegeScenarioClient = SiegeScenarioClient.getInstance();
