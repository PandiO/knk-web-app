import { logging, Controllers, HttpMethod } from '../utils';
import { LeaderboardBoardDto, LeaderboardPeriod, LeaderboardViewDto } from '../types/dtos/leaderboards/LeaderboardDtos';
import { ObjectManager } from './objectManager';

// knk-web-api LeaderboardsController (api/leaderboards, KNG-34). Boards come from snapshots; a
// signed-in viewer gets their own row; a signed-out visitor may read always-public boards only
// (401 otherwise).
export class LeaderboardClient extends ObjectManager {
  private static instance: LeaderboardClient;

  public static getInstance() {
    if (!LeaderboardClient.instance) {
      LeaderboardClient.instance = new LeaderboardClient();
      LeaderboardClient.instance.logger = logging.getLogger('LeaderboardClient');
    }
    return LeaderboardClient.instance;
  }

  getBoards(): Promise<LeaderboardBoardDto[]> {
    return this.invokeServiceCall(null, '', Controllers.Leaderboards, HttpMethod.Get);
  }

  getBoard(boardKey: string, period: LeaderboardPeriod = 'weekly', top = 25): Promise<LeaderboardViewDto> {
    return this.invokeServiceCall({ period, top }, encodeURIComponent(boardKey), Controllers.Leaderboards, HttpMethod.Get);
  }
}

export const leaderboardClient = LeaderboardClient.getInstance();
