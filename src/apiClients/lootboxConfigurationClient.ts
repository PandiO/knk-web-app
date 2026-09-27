import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { LootboxConfigurationDto, UpdateLootboxConfigurationDto } from '../types/dtos/lootbox/LootboxDtos';

// Lootboxes Phase 4: the global settings singleton (docs/specs/lootboxes/DESIGN.md §3.2). The PUT
// replaces every value, so callers always send the whole object.
class LootboxConfigurationClient extends ObjectManager {
    private static instance: LootboxConfigurationClient;

    public static getInstance() {
        if (!LootboxConfigurationClient.instance) {
            LootboxConfigurationClient.instance = new LootboxConfigurationClient();
            LootboxConfigurationClient.instance.logger = logging.getLogger('LootboxConfigurationClient');
        }
        return LootboxConfigurationClient.instance;
    }

    get(): Promise<LootboxConfigurationDto> {
        return this.invokeServiceCall(null, '', Controllers.LootboxConfiguration, HttpMethod.Get);
    }

    update(dto: UpdateLootboxConfigurationDto): Promise<LootboxConfigurationDto> {
        return this.invokeServiceCall(dto, '', Controllers.LootboxConfiguration, HttpMethod.Put);
    }
}

export const lootboxConfigurationClient = LootboxConfigurationClient.getInstance();
