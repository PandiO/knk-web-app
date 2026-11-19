import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { WeatherTypeDto, WeatherTypeListDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): weather types (api/WeatherTypes). `effects` replaces the stored list when sent.
export class WeatherTypeClient extends ObjectManager {
    private static instance: WeatherTypeClient;

    public static getInstance() {
        if (!WeatherTypeClient.instance) {
            WeatherTypeClient.instance = new WeatherTypeClient();
            WeatherTypeClient.instance.logger = logging.getLogger('WeatherTypeClient');
        }
        return WeatherTypeClient.instance;
    }

    getAll(): Promise<WeatherTypeDto[]> {
        return this.invokeServiceCall(null, '', Controllers.WeatherTypes, HttpMethod.Get);
    }

    getById(id: number): Promise<WeatherTypeDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.WeatherTypes, HttpMethod.Get);
    }

    create(data: WeatherTypeDto): Promise<WeatherTypeDto> {
        return this.invokeServiceCall(data, '', Controllers.WeatherTypes, HttpMethod.Post);
    }

    /** A null field keeps the stored value. */
    update(data: WeatherTypeDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.WeatherTypes, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.WeatherTypes, HttpMethod.Delete);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<WeatherTypeListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.WeatherTypes, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<WeatherTypeListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.WeatherTypes, HttpMethod.Post);
    }
}

export const weatherTypeClient = WeatherTypeClient.getInstance();
