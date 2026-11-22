import { logging, Controllers, HttpMethod, LandmarkOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { LandmarkDto, LandmarkListDto } from "../types/dtos/landmark/LandmarkDtos";
import { ObjectManager } from "./objectManager";

/**
 * Landmarks (off-road navigation phase 5.1, PandiO/knk-workspace#708): `api/landmarks`. Reads are public; the search
 * needs the World area node or knk.admin.world.landmark, and writes knk.admin.world.landmark (plus knk.admin.content for
 * create and edit, and knk.admin.delete for delete).
 */
export class LandmarkClient extends ObjectManager {
    private static instance: LandmarkClient;

    public static getInstance() {
        if (!LandmarkClient.instance) {
            LandmarkClient.instance = new LandmarkClient();
            LandmarkClient.instance.logger = logging.getLogger('LandmarkClient');
        }
        return LandmarkClient.instance;
    }

    /** Every landmark, or the landmarks in one world. */
    getAll(world?: string): Promise<LandmarkDto[]> {
        const query = world ? `?world=${encodeURIComponent(world)}` : LandmarkOperation.GetAll;
        return this.invokeServiceCall(null, query, Controllers.Landmarks, HttpMethod.Get);
    }

    getById(id: number | string): Promise<LandmarkDto> {
        return this.invokeServiceCall(null, `${LandmarkOperation.GetById}${id}`, Controllers.Landmarks, HttpMethod.Get);
    }

    create(data: LandmarkDto): Promise<LandmarkDto> {
        return this.invokeServiceCall(data, LandmarkOperation.Create, Controllers.Landmarks, HttpMethod.Post);
    }

    update(data: LandmarkDto): Promise<LandmarkDto> {
        if (!data.id) {
            throw new Error('LandmarkDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Landmarks, HttpMethod.Put);
    }

    delete(id: number | string): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.Landmarks, HttpMethod.Delete);
    }

    searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, LandmarkOperation.SearchPaged, Controllers.Landmarks, HttpMethod.Post);
    }

    /** The landmarks whose parent is one domain (the domain pages' list, landmark-domain LD09), by name. */
    getByDomain(domainId: number, pageSize = 100): Promise<{ items: LandmarkListDto[]; totalCount: number }> {
        return this.searchPaged({
            pageNumber: 1,
            pageSize,
            sortBy: 'name',
            filters: { parentDomainId: String(domainId) },
        } as unknown as PagedQueryDto);
    }
}

export const landmarkClient = LandmarkClient.getInstance();
