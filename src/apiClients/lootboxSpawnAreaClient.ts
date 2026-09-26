import { logging, Controllers, HttpMethod } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { LootboxSpawnAreaDto } from "../types/dtos/lootbox/LootboxDtos";
import { ObjectManager } from "./objectManager";

// Lootboxes Phase 4: spawn areas (docs/specs/lootboxes/DESIGN.md §3.2, D17). Areas made in game with
// /knk lootbox area create are ordinary rows here and are tuned with the same form. The plugin-only
// in-game create/delete endpoints are deliberately not exposed.
export class LootboxSpawnAreaClient extends ObjectManager {
    private static instance: LootboxSpawnAreaClient;

    public static getInstance() {
        if (!LootboxSpawnAreaClient.instance) {
            LootboxSpawnAreaClient.instance = new LootboxSpawnAreaClient();
            LootboxSpawnAreaClient.instance.logger = logging.getLogger('LootboxSpawnAreaClient');
        }
        return LootboxSpawnAreaClient.instance;
    }

    getAll(): Promise<LootboxSpawnAreaDto[]> {
        return this.invokeServiceCall(null, '', Controllers.LootboxSpawnAreas, HttpMethod.Get);
    }

    getById(id: string | number): Promise<LootboxSpawnAreaDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxSpawnAreas, HttpMethod.Get);
    }

    public create(data: LootboxSpawnAreaDto): Promise<LootboxSpawnAreaDto> {
        return this.invokeServiceCall(data, '', Controllers.LootboxSpawnAreas, HttpMethod.Post);
    }

    public update(data: LootboxSpawnAreaDto): Promise<void> {
        if (!data.id) {
            throw new Error('LootboxSpawnAreaDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.LootboxSpawnAreas, HttpMethod.Put);
    }

    delete(id: string | number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxSpawnAreas, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LootboxSpawnAreas, HttpMethod.Post);
    }
}

export const lootboxSpawnAreaClient = LootboxSpawnAreaClient.getInstance();
