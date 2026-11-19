import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { StockPagedQueryDto, StockPagedResultDto } from '../types/dtos/stock/StockDtos';
import { ProductionModifierDto, ProductionModifierListDto } from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 (PandiO/knk-workspace#86 API, #678 web app): stored production modifiers (api/ProductionModifiers): scope, target, effect, value and active window.
export class ProductionModifierClient extends ObjectManager {
    private static instance: ProductionModifierClient;

    public static getInstance() {
        if (!ProductionModifierClient.instance) {
            ProductionModifierClient.instance = new ProductionModifierClient();
            ProductionModifierClient.instance.logger = logging.getLogger('ProductionModifierClient');
        }
        return ProductionModifierClient.instance;
    }

    getAll(): Promise<ProductionModifierDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionModifiers, HttpMethod.Get);
    }

    getById(id: number): Promise<ProductionModifierDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionModifiers, HttpMethod.Get);
    }

    create(data: ProductionModifierDto): Promise<ProductionModifierDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionModifiers, HttpMethod.Post);
    }

    /** A null field keeps the stored value. */
    update(data: ProductionModifierDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionModifiers, HttpMethod.Put);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionModifiers, HttpMethod.Delete);
    }

    /** The dashboard table's search. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionModifierListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionModifiers, HttpMethod.Post);
    }

    /** The same search with the API's own paging (`pageNumber`) and string filters. */
    search(query: StockPagedQueryDto): Promise<StockPagedResultDto<ProductionModifierListDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.ProductionModifiers, HttpMethod.Post);
    }
}

export const productionModifierClient = ProductionModifierClient.getInstance();
