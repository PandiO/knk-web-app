import { logging, Controllers, HttpMethod, TagOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { TagDto } from "../types/dtos/tag/TagDtos";
import { ObjectManager } from "./objectManager";

export class TagClient extends ObjectManager {
    private static instance: TagClient;

    public static getInstance() {
        if (!TagClient.instance) {
            TagClient.instance = new TagClient();
            TagClient.instance.logger = logging.getLogger('TagClient');
        }
        return TagClient.instance;
    }

    getAll(): Promise<TagDto[]> {
        return this.invokeServiceCall(null, TagOperation.GetAll, Controllers.Tags, HttpMethod.Get);
    }

    getById(id: string): Promise<TagDto> {
        return this.invokeServiceCall(null, `${TagOperation.GetById}${id}`, Controllers.Tags, HttpMethod.Get);
    }

    public create(data: TagDto): Promise<TagDto> {
        return this.invokeServiceCall(data, TagOperation.Create, Controllers.Tags, HttpMethod.Post);
    }

    public update(data: TagDto): Promise<TagDto> {
        if (!data.id) {
            throw new Error('TagDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.Tags, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.Tags, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, TagOperation.SearchPaged, Controllers.Tags, HttpMethod.Post);
    }
}

export const tagClient = TagClient.getInstance();
