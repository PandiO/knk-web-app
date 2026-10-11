import { logging, Controllers, HttpMethod } from '../utils';
import { PublicPlayerProfileDto } from '../types/dtos/statistics/StatisticsDtos';
import { ObjectManager } from './objectManager';

// knk-web-api PlayersController (api/players, KNG-34): the always-public profile by username,
// anonymous; 404 for unknown or inactive accounts.
export class PlayerClient extends ObjectManager {
  private static instance: PlayerClient;

  public static getInstance() {
    if (!PlayerClient.instance) {
      PlayerClient.instance = new PlayerClient();
      PlayerClient.instance.logger = logging.getLogger('PlayerClient');
    }
    return PlayerClient.instance;
  }

  getByName(username: string): Promise<PublicPlayerProfileDto> {
    return this.invokeServiceCall(null, `by-name/${encodeURIComponent(username)}`, Controllers.Players, HttpMethod.Get);
  }
}

export const playerClient = PlayerClient.getInstance();
