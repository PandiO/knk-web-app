import { logging, Controllers, HttpMethod, CategoryOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { CategoryDto } from "../types/dtos/category/CategoryDtos";
import { ObjectManager } from "./objectManager";

export class CategoryClient extends ObjectManager {
    private static instance: CategoryClient;

    public static getInstance() {
        if (!CategoryClient.instance) {
            CategoryClient.instance = new CategoryClient();
            CategoryClient.instance.logger = logging.getLogger('CategoryClient');
        }
        return CategoryClient.instance;
    }

    getAll(): Promise<CategoryDto[]> {
        return this.invokeServiceCall(null, CategoryOperation.GetAll, Controllers.Categories, HttpMethod.Get);
    }

    getById(id: string): Promise<CategoryDto> {
        return this.invokeServiceCall(null, `${CategoryOperation.GetById}${id}`, Controllers.Categories, HttpMethod.Get);
    }

    getChildren(id: string): Promise<CategoryDto[]> {
        return this.invokeServiceCall(null, `${id}/children`, Controllers.Categories, HttpMethod.Get);
    }

    public create(data: CategoryDto): Promise<CategoryDto> {
        return this.invokeServiceCall(data, CategoryOperation.Create, Controllers.Categories, HttpMethod.Post);
    }

    public update(data: CategoryDto): Promise<CategoryDto> {
        if (!data.id) {
            throw new Error('CategoryDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.Categories, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.Categories, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, CategoryOperation.SearchPaged, Controllers.Categories, HttpMethod.Post);
    }
}
