import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { LootboxSpawnDto } from '../types/dtos/lootbox/LootboxDtos';

// Lootboxes Phase 4: the admin's view of boxes in the world (docs/specs/lootboxes/DESIGN.md §3.3).
// Only the reads and despawn - spawning and claiming are the game server's (PluginService) calls.
class LootboxSpawnClient extends ObjectManager {
    private static instance: LootboxSpawnClient;

    public static getInstance() {
        if (!LootboxSpawnClient.instance) {
            LootboxSpawnClient.instance = new LootboxSpawnClient();
            LootboxSpawnClient.instance.logger = logging.getLogger('LootboxSpawnClient');
        }
        return LootboxSpawnClient.instance;
    }

    /** Active boxes (runs the API's lazy expiry sweep first). */
    getActive(): Promise<LootboxSpawnDto[]> {
        return this.invokeServiceCall(null, 'active', Controllers.LootboxSpawns, HttpMethod.Get);
    }

    /** An Active box becomes Removed; answers with the box as it is now. The plugin drops its entity on its next refresh. */
    despawn(id: number): Promise<LootboxSpawnDto> {
        return this.invokeServiceCall({}, `${id}/despawn`, Controllers.LootboxSpawns, HttpMethod.Post);
    }
}

export const lootboxSpawnClient = LootboxSpawnClient.getInstance();
