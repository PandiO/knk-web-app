import { PagedQueryDto } from '../types/dtos/common/PagedQuery';

/**
 * PandiO/knk-workspace#39 (CRUD-1 / NAV-6): a table's page, search, sort and filters as query
 * parameters, so Back, a refresh, a shared link and a form's `returnTo` keep the view.
 *
 * `?page=2&q=north&sort=name&dir=desc&f.CategoryId=4`. Defaults (page 1, no search, no sort, no
 * filter) are left out, so an untouched table has a clean URL. Other parameters of the page are
 * kept as they are.
 */
export type TableUrlQuery = Pick<PagedQueryDto, 'page' | 'searchTerm' | 'sortBy' | 'sortDescending' | 'filters'>;

const PAGE = 'page';
const SEARCH = 'q';
const SORT = 'sort';
const DIRECTION = 'dir';
const FILTER_PREFIX = 'f.';

/** The table state the parameters describe; anything missing or invalid is the default. */
export function readTableQuery(params: URLSearchParams): TableUrlQuery {
    const rawPage = Number(params.get(PAGE));
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const sortBy = params.get(SORT)?.trim() || undefined;
    const filters: Record<string, string> = {};
    params.forEach((value, key) => {
        if (key.startsWith(FILTER_PREFIX) && key.length > FILTER_PREFIX.length && value !== '') {
            filters[key.slice(FILTER_PREFIX.length)] = value;
        }
    });
    return {
        page,
        searchTerm: params.get(SEARCH) ?? '',
        sortBy,
        sortDescending: sortBy ? params.get(DIRECTION) === 'desc' : false,
        filters,
    };
}

/** `params` with the table state written over the table's own parameters (defaults removed). */
export function writeTableQuery(params: URLSearchParams, query: Partial<TableUrlQuery>): URLSearchParams {
    const next = new URLSearchParams();
    params.forEach((value, key) => {
        if (key === PAGE || key === SEARCH || key === SORT || key === DIRECTION || key.startsWith(FILTER_PREFIX)) return;
        next.append(key, value);
    });
    if (query.page && query.page > 1) next.set(PAGE, String(query.page));
    const search = query.searchTerm?.trim() ? query.searchTerm : '';
    if (search) next.set(SEARCH, search);
    if (query.sortBy) {
        next.set(SORT, query.sortBy);
        if (query.sortDescending) next.set(DIRECTION, 'desc');
    }
    Object.entries(query.filters ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') next.set(`${FILTER_PREFIX}${key}`, String(value));
    });
    return next;
}

/** `?…` for a location search string, or '' when nothing is left. */
export function toSearch(params: URLSearchParams): string {
    const text = params.toString();
    return text ? `?${text}` : '';
}
