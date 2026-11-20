import { logging, Controllers, HttpMethod } from '../utils';
import type {
  SiegeWeaponUnlockPurchaseRequestDto,
  SiegeWeaponUnlockPurchaseResultDto,
  SiegeWeaponUnlocksOverviewDto,
} from '../types/dtos/siege/SiegeWeaponUnlockDtos';
import { ObjectManager } from './objectManager';

// knk-web-api SiegeWeaponUnlocksController (siege shop L4, PandiO/knk-workspace#869): the signed-in player's own siege
// weapon unlocks. Staff grants and revokes stay on UserSiegeWeaponUnlockClient. A refused purchase is a 409
// { code: 'NeedsTitle' | 'InsufficientFunds', message }, nothing charged.
export class SiegeWeaponUnlockClient extends ObjectManager {
  private static instance: SiegeWeaponUnlockClient;

  public static getInstance() {
    if (!SiegeWeaponUnlockClient.instance) {
      SiegeWeaponUnlockClient.instance = new SiegeWeaponUnlockClient();
      SiegeWeaponUnlockClient.instance.logger = logging.getLogger('SiegeWeaponUnlockClient');
    }
    return SiegeWeaponUnlockClient.instance;
  }

  /** Every siege weapon type with its price, minimum title and the player's state. */
  getMine(): Promise<SiegeWeaponUnlocksOverviewDto> {
    return this.invokeServiceCall(null, 'mine', Controllers.SiegeWeaponUnlocks, HttpMethod.Get);
  }

  /** Charges the coins once per type; a repeat returns alreadyUnlocked and charges nothing. */
  purchase(templateId: number): Promise<SiegeWeaponUnlockPurchaseResultDto> {
    const body: SiegeWeaponUnlockPurchaseRequestDto = { templateId };
    return this.invokeServiceCall(body, 'purchase', Controllers.SiegeWeaponUnlocks, HttpMethod.Post);
  }
}

export const siegeWeaponUnlockClient = SiegeWeaponUnlockClient.getInstance();
