import { logging, Controllers, HttpMethod } from "../utils";
import { PagedQueryDto } from "../types/dtos/common/PagedQuery";
import { LootboxSpecialEntryDto } from "../types/dtos/lootbox/LootboxDtos";
import { ObjectManager } from "./objectManager";

// Lootboxes Phase 4: the jackpot entries (docs/specs/lootboxes/DESIGN.md §3.5). Saving one tags its
// blueprint "Lootbox Special" server-side, which takes it out of the normal pools.
export class LootboxSpecialEntryClient extends ObjectManager {
    private static instance: LootboxSpecialEntryClient;

    public static getInstance() {
        if (!LootboxSpecialEntryClient.instance) {
            LootboxSpecialEntryClient.instance = new LootboxSpecialEntryClient();
            LootboxSpecialEntryClient.instance.logger = logging.getLogger('LootboxSpecialEntryClient');
        }
        return LootboxSpecialEntryClient.instance;
    }

    getAll(): Promise<LootboxSpecialEntryDto[]> {
        return this.invokeServiceCall(null, '', Controllers.LootboxSpecialEntries, HttpMethod.Get);
    }

    getById(id: string | number): Promise<LootboxSpecialEntryDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxSpecialEntries, HttpMethod.Get);
    }

    public create(data: LootboxSpecialEntryDto): Promise<LootboxSpecialEntryDto> {
        return this.invokeServiceCall(data, '', Controllers.LootboxSpecialEntries, HttpMethod.Post);
    }

    public update(data: LootboxSpecialEntryDto): Promise<void> {
        if (!data.id) {
            throw new Error('LootboxSpecialEntryDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.LootboxSpecialEntries, HttpMethod.Put);
    }

    delete(id: string | number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxSpecialEntries, HttpMethod.Delete);
    }

    public searchPaged(queryParams: PagedQueryDto): Promise<any> {
        return this.invokeServiceCall(queryParams, 'search', Controllers.LootboxSpecialEntries, HttpMethod.Post);
    }
}

export const lootboxSpecialEntryClient = LootboxSpecialEntryClient.getInstance();
