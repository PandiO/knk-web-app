import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import {
  EntityTypeConfigurationDto,
  EntityTypeConfigurationCreateDto,
  EntityTypeConfigurationUpdateDto,
  MergedEntityMetadata,
} from '../types/dtos/metadata/MetadataModels';

type EntityTypeConfigurationReadDto = EntityTypeConfigurationDto;

class EntityTypeConfigurationClient extends ObjectManager {
  private static instance: EntityTypeConfigurationClient;

  public static getInstance() {
    if (!EntityTypeConfigurationClient.instance) {
      EntityTypeConfigurationClient.instance = new EntityTypeConfigurationClient();
      EntityTypeConfigurationClient.instance.logger = logging.getLogger('EntityTypeConfigurationClient');
    }
    return EntityTypeConfigurationClient.instance;
  }

  /**
   * Get configuration by ID.
   */
  getById(id: string): Promise<EntityTypeConfigurationReadDto> {
    return this.invokeServiceCall(
      null,
      id,
      Controllers.EntityTypeConfiguration,
      HttpMethod.Get
    );
  }

  /**
   * Get configuration for a specific entity type.
   * Returns null if no configuration exists (entity uses defaults).
   */
  getByEntityTypeName(entityTypeName: string): Promise<EntityTypeConfigurationReadDto | null> {
    return this.invokeServiceCall(
      null,
      `by-entity/${entityTypeName}`,
      Controllers.EntityTypeConfiguration,
      HttpMethod.Get
    ).catch(() => null);
  }

  /**
   * Get all entity type configurations.
   */
  getAll(): Promise<EntityTypeConfigurationReadDto[]> {
    return this.invokeServiceCall(
      null,
      '',
      Controllers.EntityTypeConfiguration,
      HttpMethod.Get
    );
  }

  /**
   * Get merged metadata for a specific entity type.
   * Combines base EntityMetadata with configuration properties.
   */
  getMergedMetadata(entityTypeName: string): Promise<MergedEntityMetadata> {
    return this.invokeServiceCall(
      null,
      `merged/${entityTypeName}`,
      Controllers.EntityTypeConfiguration,
      HttpMethod.Get
    );
  }

  /**
   * Get all merged metadata.
   * Combines all EntityMetadata with all configurations.
   */
  getAllMergedMetadata(): Promise<MergedEntityMetadata[]> {
    return this.invokeServiceCall(
      null,
      'merged/all',
      Controllers.EntityTypeConfiguration,
      HttpMethod.Get
    );
  }

  /**
   * Create a new entity type configuration.
   */
  create(dto: EntityTypeConfigurationCreateDto): Promise<EntityTypeConfigurationReadDto> {
    return this.invokeServiceCall(
      dto,
      '',
      Controllers.EntityTypeConfiguration,
      HttpMethod.Post
    );
  }

  /**
   * Update an existing entity type configuration.
   */
  update(dto: EntityTypeConfigurationUpdateDto): Promise<EntityTypeConfigurationReadDto> {
    return this.invokeServiceCall(
      dto,
      dto.id,
      Controllers.EntityTypeConfiguration,
      HttpMethod.Put
    );
  }

  /**
   * Delete an entity type configuration.
   */
  delete(id: string): Promise<void> {
    return this.invokeServiceCall(
      null,
      id,
      Controllers.EntityTypeConfiguration,
      HttpMethod.Delete
    );
  }
}

export const entityTypeConfigurationClient = EntityTypeConfigurationClient.getInstance();
