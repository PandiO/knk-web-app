import { ObjectManager } from './objectManager';
import { logging, Controllers, HttpMethod } from '../utils';

/** knk-web-api `RelationshipChangeResultDto`. `changed` is false when the link already was (or wasn't) there. */
export interface RelationshipChangeResultDto {
  entityType: string;
  id: number;
  property: string;
  relatedId?: number;
  changed: boolean;
  previousId?: number;
}

/**
 * `api/Relationships/{type}/{id}/{property}` (PandiO/knk-workspace#188): Select / Add an existing record, or Unlink one.
 * Only the link changes; the related record is never deleted. Needs the type's write node (403 `NoWriteAccess`
 * with `nodes`); a child of another parent answers 409 `AlreadyLinked` with `currentId` until `move` is sent.
 */
class RelationshipClient extends ObjectManager {
  private static instance: RelationshipClient;

  public static getInstance() {
    if (!RelationshipClient.instance) {
      RelationshipClient.instance = new RelationshipClient();
      RelationshipClient.instance.logger = logging.getLogger('RelationshipClient');
    }
    return RelationshipClient.instance;
  }

  link(entityType: string, id: number | string, property: string, relatedId: number, move = false): Promise<RelationshipChangeResultDto> {
    return this.invokeServiceCall({ relatedId, move }, this.path(entityType, id, property, 'link'), Controllers.Relationships, HttpMethod.Post);
  }

  unlink(entityType: string, id: number | string, property: string, relatedId?: number): Promise<RelationshipChangeResultDto> {
    return this.invokeServiceCall({ relatedId: relatedId ?? null }, this.path(entityType, id, property, 'unlink'), Controllers.Relationships, HttpMethod.Post);
  }

  private path(entityType: string, id: number | string, property: string, action: 'link' | 'unlink'): string {
    return `${encodeURIComponent(entityType)}/${id}/${encodeURIComponent(property)}/${action}`;
  }
}

export const relationshipClient = RelationshipClient.getInstance();
