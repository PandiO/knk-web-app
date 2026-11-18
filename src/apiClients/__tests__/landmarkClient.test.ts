import { LandmarkClient } from '../landmarkClient';
import { Controllers, HttpMethod } from '../../utils';
import {
  getCreateFunctionForEntity,
  getDeleteFunctionForEntity,
  getFetchByIdFunctionForEntity,
  getSearchFunctionForEntity,
  getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

// Off-road navigation phase 5.1 (PandiO/knk-workspace#708): the dashboard, detail page and form wizard reach
// api/landmarks through the five entity mappings; the domain pages list a domain's landmarks with a domainId filter.
describe('LandmarkClient', () => {
  const client = LandmarkClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ items: [], totalCount: 0 });
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('reads all landmarks, or the landmarks of one world', async () => {
    await client.getAll();
    expect(invokeSpy).toHaveBeenLastCalledWith(null, '', Controllers.Landmarks, HttpMethod.Get);
    await client.getAll('world nether');
    expect(invokeSpy).toHaveBeenLastCalledWith(null, '?world=world%20nether', Controllers.Landmarks, HttpMethod.Get);
    expect(Controllers.Landmarks).toBe('landmarks');
  });

  it('lists the landmarks of one domain by name', async () => {
    await client.getByDomain(7);
    expect(invokeSpy).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: 100, sortBy: 'name', filters: { domainId: '7' } }, 'search', Controllers.Landmarks, HttpMethod.Post);
  });

  it('refuses an update without an id', () => {
    expect(() => client.update({ name: 'Hall' })).toThrow('id is required');
  });

  it('is registered for the dashboard, the detail page and the form wizard', async () => {
    await getSearchFunctionForEntity('Landmark')({ page: 2, pageSize: 5 } as any);
    expect(invokeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 5 }), 'search',
      Controllers.Landmarks, HttpMethod.Post);

    await getFetchByIdFunctionForEntity('Landmark')('4');
    expect(invokeSpy).toHaveBeenLastCalledWith(null, '4', Controllers.Landmarks, HttpMethod.Get);

    await getCreateFunctionForEntity('Landmark')({ name: 'Hall', locationId: 3 });
    expect(invokeSpy).toHaveBeenLastCalledWith({ name: 'Hall', locationId: 3 }, '', Controllers.Landmarks, HttpMethod.Post);

    await getUpdateFunctionForEntity('Landmark')({ id: 4, name: 'Hall' });
    expect(invokeSpy).toHaveBeenLastCalledWith({ id: 4, name: 'Hall' }, '4', Controllers.Landmarks, HttpMethod.Put);

    await getDeleteFunctionForEntity('Landmark')('4');
    expect(invokeSpy).toHaveBeenLastCalledWith(null, '4', Controllers.Landmarks, HttpMethod.Delete);
  });
});
