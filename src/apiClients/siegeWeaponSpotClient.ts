import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { findValueByFieldName } from '../utils/fieldNameMapper';
import { SiegeWeaponSpotDto } from '../types/dtos/siege/SiegeWeaponDtos';

// Siege weapons phase 1 (PandiO/knk-workspace#782): a scenario's weapon spot, created under its scenario
// (POST /api/SiegeScenarios/{id}/weapon-spots), otherwise addressed by its own id. No search endpoint. The wizard
// submits authored field names ("SiegeScenarioId"), so the parent id is read case-insensitively (SiegeObjectiveClient).
export class SiegeWeaponSpotClient extends ObjectManager {
    private static instance: SiegeWeaponSpotClient;

    public static getInstance() {
        if (!SiegeWeaponSpotClient.instance) {
            SiegeWeaponSpotClient.instance = new SiegeWeaponSpotClient();
            SiegeWeaponSpotClient.instance.logger = logging.getLogger('SiegeWeaponSpotClient');
        }
        return SiegeWeaponSpotClient.instance;
    }

    getByScenario(siegeScenarioId: number): Promise<SiegeWeaponSpotDto[]> {
        return this.invokeServiceCall(null, `${siegeScenarioId}/weapon-spots`, Controllers.SiegeScenarios, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeWeaponSpotDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeWeaponSpots, HttpMethod.Get);
    }

    create(data: SiegeWeaponSpotDto): Promise<SiegeWeaponSpotDto> {
        const siegeScenarioId = findValueByFieldName(data as unknown as Record<string, unknown>, 'siegeScenarioId');
        return this.invokeServiceCall(data, `${siegeScenarioId}/weapon-spots`, Controllers.SiegeScenarios, HttpMethod.Post);
    }

    update(data: SiegeWeaponSpotDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeWeaponSpots, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeWeaponSpots, HttpMethod.Delete);
    }
}

export const siegeWeaponSpotClient = SiegeWeaponSpotClient.getInstance();
