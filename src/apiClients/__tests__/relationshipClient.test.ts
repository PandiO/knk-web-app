import { relationshipClient } from '../relationshipClient';
import { lookupClient, LOOKUP_MAX_PAGE_SIZE } from '../lookupClient';
import { Controllers, HttpMethod } from '../../utils';

describe('relationshipClient (#188)', () => {
  let invokeSpy: jest.SpyInstance;
  beforeEach(() => { invokeSpy = jest.spyOn(relationshipClient as any, 'invokeServiceCall').mockResolvedValue({ changed: true }); });
  afterEach(() => invokeSpy.mockRestore());

  it('links an existing record, with move only when asked', async () => {
    await relationshipClient.link('Town', 4, 'streets', 11);
    expect(invokeSpy).toHaveBeenCalledWith({ relatedId: 11, move: false }, 'Town/4/streets/link', Controllers.Relationships, HttpMethod.Post);
    await relationshipClient.link('Category', 1, 'childCategories', 3, true);
    expect(invokeSpy).toHaveBeenLastCalledWith({ relatedId: 3, move: true }, 'Category/1/childCategories/link', Controllers.Relationships, HttpMethod.Post);
  });

  it('unlinks, with the related id for a collection and without it for a reference', async () => {
    await relationshipClient.unlink('ItemBlueprint', 3, 'tags', 7);
    expect(invokeSpy).toHaveBeenCalledWith({ relatedId: 7 }, 'ItemBlueprint/3/tags/unlink', Controllers.Relationships, HttpMethod.Post);
    await relationshipClient.unlink('Category', 2, 'parentCategory');
    expect(invokeSpy).toHaveBeenLastCalledWith({ relatedId: null }, 'Category/2/parentCategory/unlink', Controllers.Relationships, HttpMethod.Post);
  });
});

describe('lookupClient (#280 AM2)', () => {
  let invokeSpy: jest.SpyInstance;
  beforeEach(() => { invokeSpy = jest.spyOn(lookupClient as any, 'invokeServiceCall').mockResolvedValue({ items: [], total: 0 }); });
  afterEach(() => invokeSpy.mockRestore());

  it('searches with the term trimmed and the page capped at 50', async () => {
    await lookupClient.search('Street', '  main ', 2, 500);
    expect(invokeSpy).toHaveBeenCalledWith({ searchTerm: 'main', page: 2, pageSize: LOOKUP_MAX_PAGE_SIZE }, 'Street/search', Controllers.Lookup, HttpMethod.Post);
    await lookupClient.search('Street', '   ');
    expect(invokeSpy).toHaveBeenLastCalledWith({ searchTerm: null, page: 1, pageSize: 20 }, 'Street/search', Controllers.Lookup, HttpMethod.Post);
  });

  it('gets one label', async () => {
    await lookupClient.get('Town', 5);
    expect(invokeSpy).toHaveBeenCalledWith(null, 'Town/5', Controllers.Lookup, HttpMethod.Get);
  });
});
