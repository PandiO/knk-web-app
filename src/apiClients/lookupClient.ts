import { ObjectManager } from './objectManager';
import { logging, Controllers, HttpMethod } from '../utils';

/** One record as a picker or a relation label shows it (knk-web-api `LookupItemDto`): never more than this. */
export interface LookupItemDto {
  id: number;
  label: string;
  detail?: string;
}

export interface LookupSearchResponseDto {
  items: LookupItemDto[];
  total: number;
}

/** At most this many per page (knk-web-api `LookupService.MaxPageSize`). */
export const LOOKUP_MAX_PAGE_SIZE = 50;

/**
 * `api/Lookup/{type}` (PandiO/knk-workspace#280 AM2, DESIGN.md § 4.6.3): pickers and relation labels for anyone
 * holding an area node, also for types they can't read in full. Search by the type's own search term (users by
 * username), narrowed by the filters the type's lookup takes (#288); 404 `UnknownEntityType`, 400
 * `LookupNotAvailable` (check `lookupSearchable` / `lookupGettable` first).
 */
class LookupClient extends ObjectManager {
  private static instance: LookupClient;

  public static getInstance() {
    if (!LookupClient.instance) {
      LookupClient.instance = new LookupClient();
      LookupClient.instance.logger = logging.getLogger('LookupClient');
    }
    return LookupClient.instance;
  }

  /**
   * `filters` (PandiO/knk-workspace#288): a relation field's narrowing pickerFilters. The API passes on those the type's
   * own search accepts; another key answers 400 `LookupFilterNotAllowed`, an unusable value 400 `LookupFilterInvalid`
   * (both with `filters`). Sent only when there is one, so a plain search body stays as it was.
   */
  search(
    entityType: string,
    searchTerm: string,
    page = 1,
    pageSize = 20,
    filters?: Record<string, string>
  ): Promise<LookupSearchResponseDto> {
    const hasFilters = !!filters && Object.keys(filters).length > 0;
    return this.invokeServiceCall(
      {
        searchTerm: searchTerm.trim() || null,
        page,
        pageSize: Math.min(pageSize, LOOKUP_MAX_PAGE_SIZE),
        ...(hasFilters ? { filters } : {}),
      },
      `${encodeURIComponent(entityType)}/search`,
      Controllers.Lookup,
      HttpMethod.Post
    );
  }

  get(entityType: string, id: number | string): Promise<LookupItemDto> {
    return this.invokeServiceCall(null, `${encodeURIComponent(entityType)}/${id}`, Controllers.Lookup, HttpMethod.Get);
  }
}

export const lookupClient = LookupClient.getInstance();
