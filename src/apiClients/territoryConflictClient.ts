import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import {
    TerritoryConflictDto,
    TerritoryConflictListDto,
    TerritoryConflictResolveDto,
} from '../types/dtos/territory/TerritoryDtos';

// Territory V1 (PandiO/knk-workspace#326 API, #690 web app): conflicts are written by the game server's report and
// resolved by admins (territory DESIGN § 3). No create or update: resolve, reopen and delete only.
export class TerritoryConflictClient extends ObjectManager {
    private static instance: TerritoryConflictClient;

    public static getInstance() {
        if (!TerritoryConflictClient.instance) {
            TerritoryConflictClient.instance = new TerritoryConflictClient();
            TerritoryConflictClient.instance.logger = logging.getLogger('TerritoryConflictClient');
        }
        return TerritoryConflictClient.instance;
    }

    getAll(openOnly = false): Promise<TerritoryConflictDto[]> {
        return this.invokeServiceCall(null, openOnly ? '?openOnly=true' : '', Controllers.TerritoryConflicts, HttpMethod.Get);
    }

    getById(id: number): Promise<TerritoryConflictDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TerritoryConflicts, HttpMethod.Get);
    }

    /** Award the area to one of the two holders, or mark the lines redrawn; answers the resolved conflict. */
    resolve(id: number, data: TerritoryConflictResolveDto): Promise<TerritoryConflictDto> {
        return this.invokeServiceCall(data, `${id}/resolve`, Controllers.TerritoryConflicts, HttpMethod.Post);
    }

    /** Undo a resolution (an award leaves the game server's inputs); answers the open conflict. */
    reopen(id: number): Promise<TerritoryConflictDto> {
        return this.invokeServiceCall(null, `${id}/reopen`, Controllers.TerritoryConflicts, HttpMethod.Post);
    }

    delete(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.TerritoryConflicts, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<TerritoryConflictListDto>> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.TerritoryConflicts, HttpMethod.Post);
    }
}

export const territoryConflictClient = TerritoryConflictClient.getInstance();
