import { logging, Controllers, HttpMethod } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { LootboxOddsDto, LootboxTypeDto } from "../types/dtos/lootbox/LootboxDtos";
import { ObjectManager } from "./objectManager";

// Lootboxes Phase 4 (docs/specs/lootboxes/IMPLEMENTATION_PLAN.md): one lootbox type per item
// Category (DESIGN.md §3.2). CRUD backs the FormWizard; the grade weights, pool entries and
// enchant rolls travel inside the type and are replaced wholesale on every PUT, like Kit.Contents.
export class LootboxTypeClient extends ObjectManager {
    private static instance: LootboxTypeClient;

    public static getInstance() {
        if (!LootboxTypeClient.instance) {
            LootboxTypeClient.instance = new LootboxTypeClient();
            LootboxTypeClient.instance.logger = logging.getLogger('LootboxTypeClient');
        }
        return LootboxTypeClient.instance;
    }

    getAll(): Promise<LootboxTypeDto[]> {
        return this.invokeServiceCall(null, '', Controllers.LootboxTypes, HttpMethod.Get);
    }

    getById(id: string | number): Promise<LootboxTypeDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxTypes, HttpMethod.Get);
    }

    public create(data: LootboxTypeDto): Promise<LootboxTypeDto> {
        return this.invokeServiceCall(data, '', Controllers.LootboxTypes, HttpMethod.Post);
    }

    public update(data: LootboxTypeDto): Promise<void> {
        if (!data.id) {
            throw new Error('LootboxTypeDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.LootboxTypes, HttpMethod.Put);
    }

    delete(id: string | number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxTypes, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LootboxTypes, HttpMethod.Post);
    }

    /** The odds of one box grade (default: the type's highest), computed by the same rules as a real claim. */
    getOdds(id: number, boxStars?: number): Promise<LootboxOddsDto> {
        return this.invokeServiceCall(boxStars ? { boxStars } : null, `${id}/odds`, Controllers.LootboxTypes, HttpMethod.Get);
    }
}

export const lootboxTypeClient = LootboxTypeClient.getInstance();
