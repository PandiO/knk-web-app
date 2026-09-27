import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import {
    LootboxPagedResultDto,
    LootboxTokenDto,
    LootboxTokenGrantDto,
    LootboxTokenSearchFilters,
} from '../types/dtos/lootbox/LootboxDtos';

export interface LootboxTokenSearchQuery {
    pageNumber: number;
    pageSize: number;
    /** A token id, or part of a player's name (issued to or opened by). */
    searchTerm?: string;
    filters?: LootboxTokenSearchFilters;
}

// Lootboxes Phase 5: token items (docs/specs/lootboxes/IMPLEMENTATION_PLAN.md). Issuing, opening and
// delivering are the game server's calls; the web app lists tokens, revokes unopened ones and edits
// the grant rules (premium tier / kit -> tokens).
class LootboxTokenClient extends ObjectManager {
    private static instance: LootboxTokenClient;

    public static getInstance() {
        if (!LootboxTokenClient.instance) {
            LootboxTokenClient.instance = new LootboxTokenClient();
            LootboxTokenClient.instance.logger = logging.getLogger('LootboxTokenClient');
        }
        return LootboxTokenClient.instance;
    }

    search(query: LootboxTokenSearchQuery): Promise<LootboxPagedResultDto<LootboxTokenDto>> {
        return this.invokeServiceCall(query, 'search', Controllers.LootboxTokens, HttpMethod.Post);
    }

    /** An unopened token can no longer be opened; the game server removes the item when it is used. */
    revoke(token: string): Promise<LootboxTokenDto> {
        return this.invokeServiceCall({}, `${token}/revoke`, Controllers.LootboxTokens, HttpMethod.Post);
    }

    getGrants(): Promise<LootboxTokenGrantDto[]> {
        return this.invokeServiceCall(null, '', Controllers.LootboxTokenGrants, HttpMethod.Get);
    }

    createGrant(data: LootboxTokenGrantDto): Promise<LootboxTokenGrantDto> {
        return this.invokeServiceCall(data, '', Controllers.LootboxTokenGrants, HttpMethod.Post);
    }

    updateGrant(data: LootboxTokenGrantDto): Promise<LootboxTokenGrantDto> {
        if (!data.id) {
            throw new Error('LootboxTokenGrantDto id is required for update operation');
        }
        return this.invokeServiceCall(data, `${data.id}`, Controllers.LootboxTokenGrants, HttpMethod.Put);
    }

    deleteGrant(id: number): Promise<void> {
        return this.invokeServiceCall(null, `${id}`, Controllers.LootboxTokenGrants, HttpMethod.Delete);
    }
}

export const lootboxTokenClient = LootboxTokenClient.getInstance();
