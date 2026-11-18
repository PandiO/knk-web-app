import { logging, Controllers, HttpMethod } from '../utils';
import {
  MapConfigDto,
  MapDistrictPanelDto,
  MapMarkersDto,
  MapStructurePanelDto,
  MapTownPanelDto,
} from '../types/dtos/map/MapDtos';
import { ObjectManager } from './objectManager';

// knk-web-api MapController (api/Map, PandiO/knk-workspace#736): the public overview map. Anonymous; every route
// answers 404 while the API's Map:Enabled is off, which the page reads as "the map is off" (O27).
export class MapClient extends ObjectManager {
  private static instance: MapClient;

  public static getInstance() {
    if (!MapClient.instance) {
      MapClient.instance = new MapClient();
      MapClient.instance.logger = logging.getLogger('MapClient');
    }
    return MapClient.instance;
  }

  getConfig(): Promise<MapConfigDto> {
    return this.invokeServiceCall(null, 'config', Controllers.Map, HttpMethod.Get);
  }

  getMarkers(): Promise<MapMarkersDto> {
    return this.invokeServiceCall(null, 'markers', Controllers.Map, HttpMethod.Get);
  }

  getTown(id: number): Promise<MapTownPanelDto> {
    return this.invokeServiceCall(null, `towns/${id}`, Controllers.Map, HttpMethod.Get);
  }

  getDistrict(id: number): Promise<MapDistrictPanelDto> {
    return this.invokeServiceCall(null, `districts/${id}`, Controllers.Map, HttpMethod.Get);
  }

  getStructure(id: number): Promise<MapStructurePanelDto> {
    return this.invokeServiceCall(null, `structures/${id}`, Controllers.Map, HttpMethod.Get);
  }
}

export const mapClient = MapClient.getInstance();
