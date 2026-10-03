import { LeaderboardClient } from '../leaderboardClient';
import { Controllers, HttpMethod } from '../../utils';

describe('LeaderboardClient', () => {
  const client = LeaderboardClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('lists the boards from api/leaderboards', async () => {
    await client.getBoards();
    expect(invokeSpy).toHaveBeenCalledWith(null, '', Controllers.Leaderboards, HttpMethod.Get);
  });

  it('reads one board with period and top, encoding the board key', async () => {
    await client.getBoard('pvp_kills@siege', 'monthly', 10);
    expect(invokeSpy).toHaveBeenCalledWith({ period: 'monthly', top: 10 }, 'pvp_kills%40siege', Controllers.Leaderboards, HttpMethod.Get);

    await client.getBoard('active_playtime');
    expect(invokeSpy).toHaveBeenLastCalledWith({ period: 'weekly', top: 25 }, 'active_playtime', Controllers.Leaderboards, HttpMethod.Get);
  });
});
