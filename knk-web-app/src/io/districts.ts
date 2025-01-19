import { Controllers, DistrictsOperation, HttpMethod, logging } from "../utils";
import { ObjectManager } from "./objectManager";

export class DistrictManager extends ObjectManager {
    private static instance: DistrictManager;

    public static getInstance() {
        if (!DistrictManager.instance) {
            DistrictManager.instance = new DistrictManager();
            DistrictManager.instance.logger = logging.getLogger('DistrictManager');
        }

        return DistrictManager.instance;
    }

    getAll(data?: any): Promise<any[]> {
        return this.invokeServiceCall(data, DistrictsOperation.GetAll, Controllers.Districts, HttpMethod.Get);
    }
}