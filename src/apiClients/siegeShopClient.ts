import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { SiegeGameMode, SiegeShopCatalogueDto } from '../types/dtos/siege/SiegeShopDtos';

// Siege shop (PandiO/knk-workspace#867, DESIGN § 6.2.2): the effective catalogue of a match - the mode's defaults with
// a scenario's overrides and own entries. The game server reads it at match start; staff can preview it.
export class SiegeShopClient extends ObjectManager {
    private static instance: SiegeShopClient;

    public static getInstance() {
        if (!SiegeShopClient.instance) {
            SiegeShopClient.instance = new SiegeShopClient();
            SiegeShopClient.instance.logger = logging.getLogger('SiegeShopClient');
        }
        return SiegeShopClient.instance;
    }

    getCatalogue(mode: SiegeGameMode, scenarioId?: number | null): Promise<SiegeShopCatalogueDto> {
        const query = new URLSearchParams({ mode });
        if (scenarioId) query.set('scenarioId', String(scenarioId));
        return this.invokeServiceCall(null, `catalogue?${query.toString()}`, Controllers.SiegeShop, HttpMethod.Get);
    }
}

export const siegeShopClient = SiegeShopClient.getInstance();
