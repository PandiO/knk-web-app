import { readTableQuery, toSearch, writeTableQuery } from '../tableQueryParams';

/** PandiO/knk-workspace#39: a table's page, search, sort and filters as query parameters. */
describe('tableQueryParams', () => {
    it('reads page, search, sort, direction and filters', () => {
        expect(readTableQuery(new URLSearchParams('page=3&q=north+gate&sort=name&dir=desc&f.CategoryId=4&returnTo=%2Fx'))).toEqual({
            page: 3,
            searchTerm: 'north gate',
            sortBy: 'name',
            sortDescending: true,
            filters: { CategoryId: '4' },
        });
    });

    it('reads defaults for missing or invalid values', () => {
        expect(readTableQuery(new URLSearchParams(''))).toEqual({ page: 1, searchTerm: '', sortBy: undefined, sortDescending: false, filters: {} });
        expect(readTableQuery(new URLSearchParams('page=0&dir=desc&f.=1&f.Empty=')).page).toBe(1);
        expect(readTableQuery(new URLSearchParams('page=-2')).page).toBe(1);
        expect(readTableQuery(new URLSearchParams('page=2.5')).page).toBe(1);
        expect(readTableQuery(new URLSearchParams('page=abc')).page).toBe(1);
        // A direction without a sort column means nothing.
        expect(readTableQuery(new URLSearchParams('dir=desc')).sortDescending).toBe(false);
        expect(readTableQuery(new URLSearchParams('f.=1&f.Empty=')).filters).toEqual({});
    });

    it('writes only what differs from the defaults and keeps other parameters', () => {
        const params = writeTableQuery(new URLSearchParams('page=4&q=old&other=1&f.Old=2'), {
            page: 2, searchTerm: 'gate', sortBy: 'name', sortDescending: true, filters: { CategoryId: '4', Empty: '' },
        });
        expect(params.toString()).toBe('other=1&page=2&q=gate&sort=name&dir=desc&f.CategoryId=4');
        expect(toSearch(params)).toBe('?other=1&page=2&q=gate&sort=name&dir=desc&f.CategoryId=4');
    });

    it('leaves an untouched table out of the URL', () => {
        const params = writeTableQuery(new URLSearchParams('page=4&q=old'), { page: 1, searchTerm: '  ', sortBy: undefined, sortDescending: false, filters: {} });
        expect(params.toString()).toBe('');
        expect(toSearch(params)).toBe('');
        expect(writeTableQuery(new URLSearchParams(), { sortBy: 'id', sortDescending: false }).toString()).toBe('sort=id');
    });

    it('round-trips', () => {
        const query = { page: 5, searchTerm: 'a&b=c', sortBy: 'createdAt', sortDescending: false, filters: { TownId: '9' } };
        expect(readTableQuery(writeTableQuery(new URLSearchParams(), query))).toEqual(query);
    });
});
