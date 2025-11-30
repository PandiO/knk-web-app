import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, MetadataOperation, HttpMethod } from '../utils/enums';
import { EntityMetadataDto } from '../utils/domain/dto/metadata/MetadataModels';

class MetadataClient extends ObjectManager {
  private static instance: MetadataClient;

  public static getInstance() {
    if (!MetadataClient.instance) {
      MetadataClient.instance = new MetadataClient();
      MetadataClient.instance.logger = logging.getLogger('MetadataClient');
    }
    return MetadataClient.instance;
  }

  getAllEntityMetadata(): Promise<EntityMetadataDto[]> {
    return this.invokeServiceCall(
      null,
      MetadataOperation.Entities,
      Controllers.Metadata,
      HttpMethod.Get
    );
  }

  getEntityNames(): Promise<string[]> {
    return this.invokeServiceCall(
      null,
      MetadataOperation.EntityNames,
      Controllers.Metadata,
      HttpMethod.Get
    );
  }

  getEntityMetadata(entityName: string): Promise<EntityMetadataDto> {
    return this.invokeServiceCall(
      null,
      `${MetadataOperation.Entities}/${entityName}`,
      Controllers.Metadata,
      HttpMethod.Get
    );
  }
}

export const metadataClient = MetadataClient.getInstance();