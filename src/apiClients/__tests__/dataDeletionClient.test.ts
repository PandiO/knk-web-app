import { dataDeletionClient } from '../dataDeletionClient';
import { Controllers, HttpMethod } from '../../utils';

describe('dataDeletionClient', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(dataDeletionClient, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => spy.mockRestore());

  it('calls the player routes', async () => {
    await dataDeletionClient.getMine();
    expect(spy).toHaveBeenLastCalledWith(null, 'me', Controllers.DataDeletion, HttpMethod.Get);
    await dataDeletionClient.requestMine();
    expect(spy).toHaveBeenLastCalledWith({}, 'me', Controllers.DataDeletion, HttpMethod.Post);
    await dataDeletionClient.cancelMine();
    expect(spy).toHaveBeenLastCalledWith({}, 'me/cancel', Controllers.DataDeletion, HttpMethod.Post);
    await dataDeletionClient.confirm('tok');
    expect(spy).toHaveBeenLastCalledWith({ token: 'tok' }, 'confirm', Controllers.DataDeletion, HttpMethod.Post);
  });

  it('calls the staff routes', async () => {
    await dataDeletionClient.getForPlayer(7);
    expect(spy).toHaveBeenLastCalledWith(null, 'users/7', Controllers.DataDeletion, HttpMethod.Get);
    await dataDeletionClient.fileForPlayer(7, '');
    expect(spy).toHaveBeenLastCalledWith({ note: undefined }, 'users/7', Controllers.DataDeletion, HttpMethod.Post);
    await dataDeletionClient.fileForPlayer(7, 'asked');
    expect(spy).toHaveBeenLastCalledWith({ note: 'asked' }, 'users/7', Controllers.DataDeletion, HttpMethod.Post);
    await dataDeletionClient.cancelForPlayer(7);
    expect(spy).toHaveBeenLastCalledWith({}, 'users/7/cancel', Controllers.DataDeletion, HttpMethod.Post);
    expect(Controllers.DataDeletion).toBe('data-deletion');
  });
});
