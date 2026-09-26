import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { findValueByFieldName } from '../utils/fieldNameMapper';
import { SiegeObjectiveDto } from '../types/dtos/siege/SiegeDtos';

// Siege Phase 3 (DESIGN.md §3.6): created under its scenario
// (POST /api/SiegeScenarios/{id}/objectives), otherwise addressed by its own id. No search endpoint.
// The wizard submits authored field names ("SiegeScenarioId"), so the parent id is read
// case-insensitively to build the nested URL (same reason as GateDoorClient.create).
export class SiegeObjectiveClient extends ObjectManager {
    private static instance: SiegeObjectiveClient;

    public static getInstance() {
        if (!SiegeObjectiveClient.instance) {
            SiegeObjectiveClient.instance = new SiegeObjectiveClient();
            SiegeObjectiveClient.instance.logger = logging.getLogger('SiegeObjectiveClient');
        }
        return SiegeObjectiveClient.instance;
    }

    getById(id: number): Promise<SiegeObjectiveDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeObjectives, HttpMethod.Get);
    }

    create(data: SiegeObjectiveDto): Promise<SiegeObjectiveDto> {
        const siegeScenarioId = findValueByFieldName(data as unknown as Record<string, unknown>, 'siegeScenarioId');
        return this.invokeServiceCall(data, `${siegeScenarioId}/objectives`, Controllers.SiegeScenarios, HttpMethod.Post);
    }

    update(data: SiegeObjectiveDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeObjectives, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeObjectives, HttpMethod.Delete);
    }
}

export const siegeObjectiveClient = SiegeObjectiveClient.getInstance();
