import { useEffect, useState } from 'react';
import { metadataClient } from '../apiClients/metadataClient';
import { entityTypeConfigurationClient } from '../apiClients/entityTypeConfigurationClient';
import { EntityMetadataDto, MergedEntityMetadata, EntityTypeConfigurationDto } from '../types/dtos/metadata/MetadataModels';
import { logging } from '../utils';

/**
 * Hook: useEntityMetadata
 * 
 * Loads and merges metadata from two sources:
 * 1. Base EntityMetadata (from model annotations - structure, fields, types)
 * 2. EntityTypeConfiguration (from admin settings - icon, display color, visibility)
 * 
 * Returns merged metadata suitable for UI rendering.
 * 
 * USAGE:
 * const { allMergedMetadata, getMergedMetadata, loading, error } = useEntityMetadata();
 * 
 * // Get all merged metadata
 * const metadata = allMergedMetadata;
 * 
 * // Get specific entity metadata
 * const townMeta = await getMergedMetadata('Town');
 * 
 * // Use in UI
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 * 
 * return metadata.map(m => (
 *   <EntityCard
 *     key={m.entityName}
 *     title={m.displayName}
 *     icon={iconRegistry.getIcon(m.iconKey)}
 *     color={m.displayColor}
 *     hidden={!m.isVisible}
 *   />
 * ));
 */
export function useEntityMetadata() {
  const [allMergedMetadata, setAllMergedMetadata] = useState<MergedEntityMetadata[]>([]);
  const [baseMetadata, setBaseMetadata] = useState<EntityMetadataDto[]>([]);
  const [configurations, setConfigurations] = useState<EntityTypeConfigurationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metadata and configurations on mount
  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load base metadata and configurations in parallel
      const [baseMetaData, configs] = await Promise.all([
        metadataClient.getAllEntityMetadata(),
        entityTypeConfigurationClient.getAll(),
      ]);

      setBaseMetadata(baseMetaData);
      setConfigurations(configs);

      // Merge and set
      const merged = mergeMetadata(baseMetaData, configs);
      setAllMergedMetadata(merged);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load metadata';
      setError(errorMsg);
      console.error('Failed to load entity metadata:', err);
      logging.errorHandler.next('ErrorMessage.Metadata.LoadFailed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get merged metadata for a specific entity by name.
   * Can be called individually for lazy loading a specific entity.
   */
  const getMergedMetadata = async (entityName: string): Promise<MergedEntityMetadata | null> => {
    try {
      // First check if we already have it in memory
      const existing = allMergedMetadata.find(m => m.entityName === entityName);
      if (existing) return existing;

      // Otherwise fetch it fresh
      return await entityTypeConfigurationClient.getMergedMetadata(entityName);
    } catch (err) {
      console.error(`Failed to load metadata for ${entityName}:`, err);
      return null;
    }
  };

  /**
   * Refresh all metadata (useful when admin updates configuration)
   */
  const refresh = async () => {
    await loadMetadata();
  };

  /**
   * Create a new entity type configuration
   */
  const createConfiguration = async (config: any): Promise<EntityTypeConfigurationDto | null> => {
    try {
      const created = await entityTypeConfigurationClient.create(config);
      setConfigurations(prev => [...prev, created]);
      // Refresh merged metadata
      await refresh();
      return created;
    } catch (err) {
      console.error('Failed to create entity configuration:', err);
      logging.errorHandler.next('ErrorMessage.EntityConfiguration.CreateFailed');
      return null;
    }
  };

  /**
   * Update an existing entity type configuration
   */
  const updateConfiguration = async (config: any): Promise<EntityTypeConfigurationDto | null> => {
    try {
      const updated = await entityTypeConfigurationClient.update(config);
      setConfigurations(prev => prev.map(c => c.id === config.id ? updated : c));
      // Refresh merged metadata
      await refresh();
      return updated;
    } catch (err) {
      console.error('Failed to update entity configuration:', err);
      logging.errorHandler.next('ErrorMessage.EntityConfiguration.UpdateFailed');
      return null;
    }
  };

  /**
   * Delete an entity type configuration
   */
  const deleteConfiguration = async (id: string): Promise<boolean> => {
    try {
      await entityTypeConfigurationClient.delete(id);
      setConfigurations(prev => prev.filter(c => c.id !== id));
      // Refresh merged metadata
      await refresh();
      return true;
    } catch (err) {
      console.error('Failed to delete entity configuration:', err);
      logging.errorHandler.next('ErrorMessage.EntityConfiguration.DeleteFailed');
      return false;
    }
  };

  return {
    // Data
    allMergedMetadata,
    baseMetadata,
    configurations,

    // State
    loading,
    error,

    // Methods
    getMergedMetadata,
    refresh,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
  };
}

/**
 * Merge base metadata with configurations
 * Orders by sortOrder and displayName for consistent UI presentation
 */
function mergeMetadata(
  baseMetadata: EntityMetadataDto[],
  configurations: EntityTypeConfigurationDto[]
): MergedEntityMetadata[] {
  const configsByEntity = new Map(
    configurations.map(c => [c.entityTypeName.toLowerCase(), c])
  );

  const merged = baseMetadata.map(base => {
    const config = configsByEntity.get(base.entityName.toLowerCase());
    return {
      ...base,
      configuration: config,
      iconKey: config?.iconKey,
      customIconUrl: config?.customIconUrl,
      displayColor: config?.displayColor,
      sortOrder: config?.sortOrder ?? 0,
      isVisible: config?.isVisible ?? true,
    } as MergedEntityMetadata;
  });

  // Filter hidden entities and sort
  return merged
    .filter(m => m.isVisible)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.displayName.localeCompare(b.displayName);
    });
}
