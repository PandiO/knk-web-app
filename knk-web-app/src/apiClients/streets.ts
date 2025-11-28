import { logging, Controllers, HttpMethod, StreetsOperation } from "../utils";
import { ObjectManager } from "./objectManager";

export class StreetManager extends ObjectManager {
    private static instance: StreetManager;

    public static getInstance() {
        if (!StreetManager.instance) {
            StreetManager.instance = new StreetManager();
            StreetManager.instance.logger = logging.getLogger('StreetManager');
        }

        return StreetManager.instance;
    }

    getAll(data?: any): Promise<any[]> {
        return this.invokeServiceCall(data, StreetsOperation.GetAll, Controllers.Streets, HttpMethod.Get);
    }
}