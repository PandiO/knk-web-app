import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import {
  GameSettingsDto,
  HubDomainDto,
  GameSettingsRuntimeWorldsUpdateDto,
  GameSettingsUpdateDto,
} from '../types/dtos/gameSettings/GameSettingsModels';

class GameSettingsClient extends ObjectManager {
  private static instance: GameSettingsClient;

  public static getInstance() {
    if (!GameSettingsClient.instance) {
      GameSettingsClient.instance = new GameSettingsClient();
      GameSettingsClient.instance.logger = logging.getLogger('GameSettingsClient');
    }
    return GameSettingsClient.instance;
  }

  get(): Promise<GameSettingsDto> {
    return this.invokeServiceCall(null, '', Controllers.GameSettings, HttpMethod.Get);
  }

  update(dto: GameSettingsUpdateDto): Promise<GameSettingsDto> {
    return this.invokeServiceCall(dto, '', Controllers.GameSettings, HttpMethod.Put);
  }

  updateRuntimeWorlds(dto: GameSettingsRuntimeWorldsUpdateDto): Promise<GameSettingsDto> {
    return this.invokeServiceCall(dto, 'runtime-worlds', Controllers.GameSettings, HttpMethod.Put);
  }

  /** The hub-eligible domains, the selected one marked (hub DESIGN §16.4 decision 4). */
  getHubDomains(): Promise<HubDomainDto[]> {
    return this.invokeServiceCall(null, 'hub/domains', Controllers.GameSettings, HttpMethod.Get);
  }

  /** Flags or unflags a domain as hub-eligible; the API refuses nested hubs and unflagging the selected hub. */
  setHubEligible(domainId: number, isHub: boolean): Promise<HubDomainDto> {
    return this.invokeServiceCall({ isHub }, `hub/domains/${domainId}`, Controllers.GameSettings, HttpMethod.Put);
  }
}

export const gameSettingsClient = GameSettingsClient.getInstance();
