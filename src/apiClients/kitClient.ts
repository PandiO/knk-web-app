import { logging, Controllers, HttpMethod, KitOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { KitDto } from "../types/dtos/kit/KitDtos";
import { ObjectManager } from "./objectManager";

export class KitClient extends ObjectManager {
    private static instance: KitClient;

    public static getInstance() {
        if (!KitClient.instance) {
            KitClient.instance = new KitClient();
            KitClient.instance.logger = logging.getLogger('KitClient');
        }
        return KitClient.instance;
    }

    getAll(): Promise<KitDto[]> {
        return this.invokeServiceCall(null, KitOperation.GetAll, Controllers.Kits, HttpMethod.Get);
    }

    getById(id: string): Promise<KitDto> {
        return this.invokeServiceCall(null, `${KitOperation.GetById}${id}`, Controllers.Kits, HttpMethod.Get);
    }

    public create(data: KitDto): Promise<KitDto> {
        return this.invokeServiceCall(data, KitOperation.Create, Controllers.Kits, HttpMethod.Post);
    }

    public update(data: KitDto): Promise<KitDto> {
        if (!data.id) {
            throw new Error('KitDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.Kits, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.Kits, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, KitOperation.SearchPaged, Controllers.Kits, HttpMethod.Post);
    }
}
