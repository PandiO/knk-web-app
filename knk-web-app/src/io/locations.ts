import { logging, LocationsOperation, Controllers, HttpMethod } from "../utils";
import { LocationCreateDTO } from "../utils/domain/dto/LocationCreateDTO";
import { ObjectManager } from "./objectManager";

export class LocationsManager extends ObjectManager {
    private static instance: LocationsManager;

    public static getInstance() {
        if (!LocationsManager.instance) {
            LocationsManager.instance = new LocationsManager();
            LocationsManager.instance.logger = logging.getLogger('LocationsManager');
        }

        return LocationsManager.instance;
    }

    getAll(data?: any): Promise<any[]> {
        return this.invokeServiceCall(data, LocationsOperation.GetAll, Controllers.Locations, HttpMethod.Get);
    }
}