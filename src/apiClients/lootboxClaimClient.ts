import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { LootboxClaimLogDto, LootboxClaimSearchFilters, LootboxPagedResultDto } from '../types/dtos/lootbox/LootboxDtos';

export interface LootboxClaimSearchQuery {
    pageNumber: number;
    pageSize: number;
    /** Matches the player's name or the item's name. */
    searchTerm?: string;
    filters?: LootboxClaimSearchFilters;
}

// Lootboxes Phase 4: the drop log (docs/specs/lootboxes/DESIGN.md §3.3), newest first. Delivery,
// pending and staff gives are the game server's calls and are not exposed here.
class LootboxClaimClient extends ObjectManager {
    private static instance: LootboxClaimClient;

    public static getInstance() {
        if (!LootboxClaimClient.instance) {
            LootboxClaimClient.instance = new LootboxClaimClient();
            LootboxClaimClient.instance.logger = logging.getLogger('LootboxClaimClient');
        }
        return LootboxClaimClient.instance;
    }

    search(query: LootboxClaimSearchQuery): Promise<LootboxPagedResultDto<LootboxClaimLogDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.LootboxClaims, HttpMethod.Post);
    }
}

export const lootboxClaimClient = LootboxClaimClient.getInstance();
