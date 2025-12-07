import { logging, Controllers, HttpMethod } from "../utils";
import { PagedQueryDto } from "../utils/domain/dto/common/PagedQuery";
import { LocationDto } from "../utils/domain/dto/locations/LocationModels";
import { ObjectManager } from "./objectManager";

export enum LocationOperation {
    GetAll = 'GetAll',
    GetById = 'GetById/',
    Create = 'Create',
    SearchPaged = 'search'
}

export class LocationClient extends ObjectManager {
    private static instance: LocationClient;

    public static getInstance() {
        if (!LocationClient.instance) {
            LocationClient.instance = new LocationClient();
            LocationClient.instance.logger = logging.getLogger('LocationClient');
        }
        return LocationClient.instance;
    }

    getAll(): Promise<LocationDto[]> {
        return this.invokeServiceCall(null, LocationOperation.GetAll, Controllers.Locations, HttpMethod.Get);
    }

    getById(id: number): Promise<LocationDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Locations, HttpMethod.Get);
    }

    public create(data: LocationDto): Promise<LocationDto> {
        return this.invokeServiceCall(data, null, Controllers.Locations, HttpMethod.Post);
    }

    public update(data: LocationDto): Promise<LocationDto> {
        if (!data.id) {
            throw new Error('LocationDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id.toString(), Controllers.Locations, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, id.toString(), Controllers.Locations, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, LocationOperation.SearchPaged, Controllers.Locations, HttpMethod.Post);
    }
}

export const locationClient = LocationClient.getInstance();
