import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ClimateZoneDto, ClimateZoneListDto, WeatherRollDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): climate zones (api/ClimateZones). `weatherOdds` and `towns` replace the stored lists when sent; `rolls` is read only.
export class ClimateZoneClient extends ObjectManager {
    private static instance: ClimateZoneClient;

    public static getInstance() {
        if (!ClimateZoneClient.instance) {
            ClimateZoneClient.instance = new ClimateZoneClient();
            ClimateZoneClient.instance.logger = logging.getLogger('ClimateZoneClient');
        }
        return ClimateZoneClient.instance;
    }

    getAll(): Promise<ClimateZoneDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ClimateZones, HttpMethod.Get);
    }

    getById(id: number): Promise<ClimateZoneDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ClimateZones, HttpMethod.Get);
    }

    create(data: ClimateZoneDto): Promise<ClimateZoneDto> {
        return this.invokeServiceCall(data, '', Controllers.ClimateZones, HttpMethod.Post);
    }

    /** A null field keeps the stored value. */
    update(data: ClimateZoneDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ClimateZones, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ClimateZones, HttpMethod.Delete);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ClimateZoneListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ClimateZones, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ClimateZoneListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ClimateZones, HttpMethod.Post);
    }

    /** The stored weather rolls, newest first. Filter: `climateZoneId`. */
    searchRolls(query: StockPagedQueryDto): Promise<StockPagedResultDto<WeatherRollDto>> {
        return this.invokeServiceCall(query, 'rolls/search', Controllers.ClimateZones, HttpMethod.Post);
    }
}

export const climateZoneClient = ClimateZoneClient.getInstance();
