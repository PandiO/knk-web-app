import { logging, Controllers, HttpMethod, ItemBlueprintOperation } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { ItemBlueprintDto } from "../types/dtos/itemBlueprint/ItemBlueprintDtos";
import { ObjectManager } from "./objectManager";

export class ItemBlueprintClient extends ObjectManager {
    private static instance: ItemBlueprintClient;

    public static getInstance() {
        if (!ItemBlueprintClient.instance) {
            ItemBlueprintClient.instance = new ItemBlueprintClient();
            ItemBlueprintClient.instance.logger = logging.getLogger('ItemBlueprintClient');
        }
        return ItemBlueprintClient.instance;
    }

    getAll(): Promise<ItemBlueprintDto[]> {
        return this.invokeServiceCall(null, ItemBlueprintOperation.GetAll, Controllers.ItemBlueprints, HttpMethod.Get);
    }

    getById(id: string): Promise<ItemBlueprintDto> {
        return this.invokeServiceCall(null, `${ItemBlueprintOperation.GetById}${id}`, Controllers.ItemBlueprints, HttpMethod.Get);
    }

    public create(data: ItemBlueprintDto): Promise<ItemBlueprintDto> {
        return this.invokeServiceCall(data, ItemBlueprintOperation.Create, Controllers.ItemBlueprints, HttpMethod.Post);
    }

    public update(data: ItemBlueprintDto): Promise<ItemBlueprintDto> {
        if (!data.id) {
            throw new Error('ItemBlueprintDto id is required for update operation');
        }
        return this.invokeServiceCall(data, data.id, Controllers.ItemBlueprints, HttpMethod.Put);
    }

    delete(id: string): Promise<void> {
        return this.invokeServiceCall(null, id, Controllers.ItemBlueprints, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, ItemBlueprintOperation.SearchPaged, Controllers.ItemBlueprints, HttpMethod.Post);
    }
}
