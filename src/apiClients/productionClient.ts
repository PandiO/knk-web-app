import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { ProductionSweepResultDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): the engine's staff actions (api/Production).
export class ProductionClient extends ObjectManager {
    private static instance: ProductionClient;

    public static getInstance() {
        if (!ProductionClient.instance) {
            ProductionClient.instance = new ProductionClient();
            ProductionClient.instance.logger = logging.getLogger('ProductionClient');
        }
        return ProductionClient.instance;
    }

    /** Runs a sweep now (weather rolls and due lines): 409 while `Production:Enabled` is off. */
    runNow(): Promise<ProductionSweepResultDto> {
        return this.invokeServiceCall(null, 'run-now', Controllers.Production, HttpMethod.Post);
    }
}

export const productionClient = ProductionClient.getInstance();
