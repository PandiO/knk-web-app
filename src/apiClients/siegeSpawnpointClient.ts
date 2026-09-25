import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { findValueByFieldName } from '../utils/fieldNameMapper';
import { SiegeSpawnpointDto } from '../types/dtos/siege/SiegeDtos';

// Siege Phase 3 (DESIGN.md §3.5): created under its team (POST /api/SiegeTeams/{id}/spawnpoints),
// otherwise addressed by its own id. No search endpoint, like bannerlayer/gatedoor.
// The wizard submits authored field names ("SiegeTeamId"), so the parent id is read
// case-insensitively to build the nested URL (same reason as GateDoorClient.create).
export class SiegeSpawnpointClient extends ObjectManager {
    private static instance: SiegeSpawnpointClient;

    public static getInstance() {
        if (!SiegeSpawnpointClient.instance) {
            SiegeSpawnpointClient.instance = new SiegeSpawnpointClient();
            SiegeSpawnpointClient.instance.logger = logging.getLogger('SiegeSpawnpointClient');
        }
        return SiegeSpawnpointClient.instance;
    }

    getById(id: number): Promise<SiegeSpawnpointDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeSpawnpoints, HttpMethod.Get);
    }

    create(data: SiegeSpawnpointDto): Promise<SiegeSpawnpointDto> {
        const siegeTeamId = findValueByFieldName(data as unknown as Record<string, unknown>, 'siegeTeamId');
        return this.invokeServiceCall(data, `${siegeTeamId}/spawnpoints`, Controllers.SiegeTeams, HttpMethod.Post);
    }

    update(data: SiegeSpawnpointDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeSpawnpoints, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeSpawnpoints, HttpMethod.Delete);
    }
}

export const siegeSpawnpointClient = SiegeSpawnpointClient.getInstance();
