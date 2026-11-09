import { ObjectManager } from './objectManager';
import { logging, Controllers, HttpMethod } from '../utils';
import { LookupItemDto } from './lookupClient';

/**
 * One reference that stops a delete (knk-web-api `EntityReferenceGroupDto`, PandiO/knk-workspace#44): `referencedBy` as the
 * 409's `references` name it ("Structure.StreetId", "District (link)"), every row counted, up to `take` named.
 */
export interface EntityReferenceGroupDto {
  referencedBy: string;
  /** The rows' type (`Structure`); null when a row has no single id. */
  entityType?: string | null;
  count: number;
  /** False: only counted (no read node and no area node, or not a dashboard type); `reason` says why. */
  listed: boolean;
  /** The caller holds one of the type's read nodes: each row may link to its page. */
  readable: boolean;
  /** The type's read nodes (any one). */
  nodes: string[];
  reason?: string;
  rows: LookupItemDto[];
  /** More rows than listed. */
  more: boolean;
}

export interface EntityReferenceRowsDto {
  entityTypeName: string;
  id: number;
  groups: EntityReferenceGroupDto[];
}

/**
 * `GET api/EntityReferences/{type}/{id}/rows` (PandiO/knk-workspace#44): fetched only when "Show details" is pressed.
 * Needs one of the type's read nodes (403 `NoReadAccess`); never more than id + label per row.
 */
class EntityReferenceClient extends ObjectManager {
  private static instance: EntityReferenceClient;

  public static getInstance() {
    if (!EntityReferenceClient.instance) {
      EntityReferenceClient.instance = new EntityReferenceClient();
      EntityReferenceClient.instance.logger = logging.getLogger('EntityReferenceClient');
    }
    return EntityReferenceClient.instance;
  }

  getRows(entityType: string, id: number | string, options: { referencedBy?: string; take?: number } = {}): Promise<EntityReferenceRowsDto> {
    const params = new URLSearchParams();
    if (options.referencedBy) params.set('referencedBy', options.referencedBy);
    if (options.take) params.set('take', String(options.take));
    const query = params.toString();
    return this.invokeServiceCall(
      null,
      `${encodeURIComponent(entityType)}/${encodeURIComponent(String(id))}/rows${query ? `?${query}` : ''}`,
      Controllers.EntityReferences,
      HttpMethod.Get
    );
  }
}

export const entityReferenceClient = EntityReferenceClient.getInstance();
