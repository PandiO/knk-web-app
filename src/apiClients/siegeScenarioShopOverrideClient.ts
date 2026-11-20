import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { findValueByFieldName } from '../utils/fieldNameMapper';
import { SiegeScenarioShopOverrideDto } from '../types/dtos/siege/SiegeShopDtos';

// Siege shop (PandiO/knk-workspace#867): a scenario's shop override, created under its scenario
// (POST /api/SiegeScenarios/{id}/shop-overrides), otherwise addressed by its own id. No search endpoint. The wizard
// submits authored field names ("SiegeScenarioId"), so the parent id is read case-insensitively (SiegeWeaponSpotClient).
export class SiegeScenarioShopOverrideClient extends ObjectManager {
    private static instance: SiegeScenarioShopOverrideClient;

    public static getInstance() {
        if (!SiegeScenarioShopOverrideClient.instance) {
            SiegeScenarioShopOverrideClient.instance = new SiegeScenarioShopOverrideClient();
            SiegeScenarioShopOverrideClient.instance.logger = logging.getLogger('SiegeScenarioShopOverrideClient');
        }
        return SiegeScenarioShopOverrideClient.instance;
    }

    getByScenario(siegeScenarioId: number): Promise<SiegeScenarioShopOverrideDto[]> {
        return this.invokeServiceCall(null, `${siegeScenarioId}/shop-overrides`, Controllers.SiegeScenarios, HttpMethod.Get);
    }

    getById(id: number): Promise<SiegeScenarioShopOverrideDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeScenarioShopOverrides, HttpMethod.Get);
    }

    create(data: SiegeScenarioShopOverrideDto): Promise<SiegeScenarioShopOverrideDto> {
        const siegeScenarioId = findValueByFieldName(data as unknown as Record<string, unknown>, 'siegeScenarioId');
        return this.invokeServiceCall(data, `${siegeScenarioId}/shop-overrides`, Controllers.SiegeScenarios, HttpMethod.Post);
    }

    update(data: SiegeScenarioShopOverrideDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.SiegeScenarioShopOverrides, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.SiegeScenarioShopOverrides, HttpMethod.Delete);
    }
}

export const siegeScenarioShopOverrideClient = SiegeScenarioShopOverrideClient.getInstance();
