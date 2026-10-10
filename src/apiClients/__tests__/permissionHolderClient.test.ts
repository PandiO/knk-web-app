import { PermissionHolderClient } from '../permissionHolderClient';
import { Controllers, HttpMethod } from '../../utils';
import { getFetchByIdFunctionForEntity, getSearchFunctionForEntity } from '../../utils/entityApiMapping';

describe('PermissionHolderClient', () => {
  const client = PermissionHolderClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ items: [], totalCount: 0 });
  });

  afterEach(() => invokeSpy.mockRestore());

  it('uses the read-only PermissionHolders endpoints', async () => {
    const query = { page: 1, pageSize: 10, searchTerm: 'roy' } as any;
    await client.searchPaged(query);
    expect(invokeSpy).toHaveBeenCalledWith(query, 'search', Controllers.PermissionHolders, HttpMethod.Post);

    await client.getById(7);
    expect(invokeSpy).toHaveBeenCalledWith(null, '7', Controllers.PermissionHolders, HttpMethod.Get);
  });

  it('is registered for FormWizard relationship search and edit hydration', async () => {
    await getSearchFunctionForEntity('PermissionHolder')({ page: 2, pageSize: 5 } as any);
    expect(invokeSpy).toHaveBeenCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 5 }),
      'search', Controllers.PermissionHolders, HttpMethod.Post);

    await getFetchByIdFunctionForEntity('PermissionHolder')('8');
    expect(invokeSpy).toHaveBeenCalledWith(null, '8', Controllers.PermissionHolders, HttpMethod.Get);
  });
});
