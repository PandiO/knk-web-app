import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { ItemInstanceDto } from '../types/dtos/lootbox/LootboxDtos';

// One minted item by the id in its knightsandkings:knk_item_instance PDC tag
// (docs/specs/lootboxes/DESIGN.md §3.2-§3.3). Read-only: services mint instances.
class ItemInstanceClient extends ObjectManager {
    private static instance: ItemInstanceClient;

    public static getInstance() {
        if (!ItemInstanceClient.instance) {
            ItemInstanceClient.instance = new ItemInstanceClient();
            ItemInstanceClient.instance.logger = logging.getLogger('ItemInstanceClient');
        }
        return ItemInstanceClient.instance;
    }

    getById(id: number): Promise<ItemInstanceDto> {
        return this.invokeServiceCall(null, `${id}`, Controllers.ItemInstances, HttpMethod.Get);
    }
}

export const itemInstanceClient = ItemInstanceClient.getInstance();
