import { TitleBracketClient } from '../titleBracketClient';
import { Controllers, HttpMethod } from '../../utils';
import { getFetchByIdFunctionForEntity, getSearchFunctionForEntity } from '../../utils/entityApiMapping';

// Teleport Phase 5: the TitleBracket object picker on the Town/District/Structure forms (a
// destination's minimum title) searches and loads brackets through api/TitleBrackets.
describe('TitleBracketClient', () => {
  const client = TitleBracketClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ items: [], totalCount: 0 });
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('getById reads TitleBrackets/{id}', async () => {
    await client.getById(3);
    expect(invokeSpy).toHaveBeenCalledWith(null, '3', Controllers.TitleBrackets, HttpMethod.Get);
  });

  it('searchPaged posts to TitleBrackets/search', async () => {
    const query = { pageNumber: 1, pageSize: 10, searchTerm: 'kni' } as any;
    await client.searchPaged(query);
    expect(invokeSpy).toHaveBeenCalledWith(query, 'search', Controllers.TitleBrackets, HttpMethod.Post);
  });

  it('is registered for the FormWizard object picker (search + fetch by id)', async () => {
    await getSearchFunctionForEntity('TitleBracket')({ page: 2, pageSize: 5 } as any);
    expect(invokeSpy).toHaveBeenCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 5 }), 'search',
      Controllers.TitleBrackets, HttpMethod.Post);

    await getFetchByIdFunctionForEntity('TitleBracket')('4');
    expect(invokeSpy).toHaveBeenCalledWith(null, '4', Controllers.TitleBrackets, HttpMethod.Get);
  });
});
