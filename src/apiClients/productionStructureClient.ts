import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import {
    ProductionStructureDto,
    ProductionWorldListDto,
    RoadConnectionUpdateDto,
} from '../types/dtos/structure/ProductionWorldDtos';
import {
    ProductionOverviewDto,
    ProductionUpgradeRequestDto,
    ProductionUpgradeResultDto,
    WorkersPresentUpdateDto,
} from '../types/dtos/production/ProductionEngineDtos';
import {
    ProductionAreaDto,
    ProductionYieldDto,
    SurveyRequestDto,
    YieldMaterializationDto,
} from '../types/dtos/production/ProductionYieldDtos';

// P2 world (PandiO/knk-workspace#91 API, #676 web app): production structures (api/ProductionStructures), mostly rural.
// The create answers the structure with its output storage and any placement warnings (`placementWarnings`); a read
// carries the dashboard `warnings` (contested, outside territory, not connected to the roads).
export class ProductionStructureClient extends ObjectManager {
    private static instance: ProductionStructureClient;

    public static getInstance() {
        if (!ProductionStructureClient.instance) {
            ProductionStructureClient.instance = new ProductionStructureClient();
            ProductionStructureClient.instance.logger = logging.getLogger('ProductionStructureClient');
        }
        return ProductionStructureClient.instance;
    }

    getAll(): Promise<ProductionStructureDto[]> {
        return this.invokeServiceCall(null, '', Controllers.ProductionStructures, HttpMethod.Get);
    }

    /** With `storages`, `warnings`, `effectiveTownId` and `isRural`. */
    getById(id: number): Promise<ProductionStructureDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionStructures, HttpMethod.Get);
    }

    create(data: ProductionStructureDto): Promise<ProductionStructureDto> {
        return this.invokeServiceCall(data, '', Controllers.ProductionStructures, HttpMethod.Post);
    }

    update(data: ProductionStructureDto): Promise<void> {
        return this.invokeServiceCall(data, `${data.id}`, Controllers.ProductionStructures, HttpMethod.Put);
    }

    /** 409 while one of its storages holds stock or has ledger history. */
    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ProductionStructures, HttpMethod.Delete);
    }

    /** Filters: `districtId`, `townId` (effective), `isRural`, `territoryFlag`, `productionKindId`, `roadConnection`. */
    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<ProductionWorldListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.ProductionStructures, HttpMethod.Post);
    }

    /** The road connection the game server measured (plugin key or knk.admin.world). */
    setRoadConnection(id: number, data: RoadConnectionUpdateDto): Promise<ProductionStructureDto> {
        return this.invokeServiceCall(data, `${id}/road-connection`, Controllers.ProductionStructures, HttpMethod.Put);
    }

    /** P3 (#678): the production view: lines with their rate breakdown, why not producing, the latest cycles. Settles
     *  first while the feature is on. */
    getProduction(id: number): Promise<ProductionOverviewDto> {
        return this.invokeServiceCall(null, `${id}/production`, Controllers.ProductionStructures, HttpMethod.Get);
    }

    /** P3: the workers at the structure now (0..workersTotal); settles first. Answers the production view. */
    setWorkers(id: number, data: WorkersPresentUpdateDto): Promise<ProductionOverviewDto> {
        return this.invokeServiceCall(data, `${id}/workers`, Controllers.ProductionStructures, HttpMethod.Put);
    }

    /** P3: raise the level by one, paying the next level's cost (knk.admin.world and knk.economy.admin). 400 without a
     *  payer when the level costs coins, 409 when the cost can't be paid or at level 10. */
    upgrade(id: number, data: ProductionUpgradeRequestDto): Promise<ProductionUpgradeResultDto> {
        return this.invokeServiceCall(data, `${id}/upgrade`, Controllers.ProductionStructures, HttpMethod.Post);
    }

    /** P4 (#680): the structure's yield source, areas and every output with the survey units, shares, yield rows and
     *  Hybrid override behind its base rate. */
    getYield(id: number): Promise<ProductionYieldDto> {
        return this.invokeServiceCall(null, `${id}/yield`, Controllers.ProductionStructures, HttpMethod.Get);
    }

    /** P4 "survey now": asks the game server to survey the enabled areas (or one) at its next poll; answers the areas
     *  marked. 409 for a Configured structure (G5) or one without an enabled area. */
    requestSurvey(id: number, data: SurveyRequestDto = {}): Promise<ProductionAreaDto[]> {
        return this.invokeServiceCall(data, `${id}/survey`, Controllers.ProductionStructures, HttpMethod.Post);
    }

    /** P4 staff tool: makes the lines from the latest surveys and pins again (it also runs after every survey). */
    materialize(id: number): Promise<YieldMaterializationDto> {
        return this.invokeServiceCall(null, `${id}/materialize`, Controllers.ProductionStructures, HttpMethod.Post);
    }
}

export const productionStructureClient = ProductionStructureClient.getInstance();
