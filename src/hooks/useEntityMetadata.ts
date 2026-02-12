import { useEffect, useState, useMemo, useCallback } from 'react';
import { metadataClient } from '../apiClients/metadataClient';
import { entityTypeConfigurationClient } from '../apiClients/entityTypeConfigurationClient';
import { EntityMetadataDto, MergedEntityMetadata, EntityTypeConfigurationDto, FieldMetadataDto } from '../types/dtos/metadata/MetadataModels';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../types/dtos/forms/FormModels';
import { FieldValidationRuleDto, DependencyResolutionRequest, DependencyResolutionResponse, ResolvedDependency } from '../types/dtos/forms/FieldValidationRuleDtos';
import { fieldValidationRuleClient } from '../apiClients/fieldValidationRuleClient';
import { logging } from '../utils';

/**
 * Metadata about a form field including validation rules and entity context.
 */
export interface FormFieldMetadata {
  fieldId: number;
  fieldName: string;
  label: string;
  fieldType: string;
  objectType?: string;
  validationRules: FieldValidationRuleDto[];
  entityMetadata?: EntityMetadataDto;
}

/**
 * Enriched form context type that includes metadata and resolved dependencies.
 */
export interface EnrichedFormContextType {
  // Form state
  values: Record<string, any>;
  
  // Metadata
  fieldMetadata: Map<number, FormFieldMetadata>;
  entityMetadata: Map<string, EntityMetadataDto>;
  mergedEntityMetadata: Map<string, MergedEntityMetadata>;
  
  // Resolved dependencies
  resolvedDependencies: Map<number, ResolvedDependency>;
  
  // State management
  isLoading: boolean;
  error: string | null;
  
  // Methods
  setFieldValue: (fieldName: string, value: any) => Promise<void>;
  resolveDependency: (ruleId: number) => Promise<ResolvedDependency | null>;
  resolveDependenciesBatch: (fieldIds: number[]) => Promise<DependencyResolutionResponse | null>;
  refresh: () => Promise<void>;
}

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

/**
 * Hook: useEnrichedFormContext
 * 
 * Manages a rich form context that includes:
 * 1. Form field values
 * 2. Field metadata (structure, types, validation rules)
 * 3. Entity metadata (for understanding object relationships)
 * 4. Resolved dependencies (pre-computed validation dependencies)
 * 
 * USAGE:
 * const formContext = useEnrichedFormContext(formConfiguration);
 * 
 * if (formContext.isLoading) return <Spinner />;
 * if (formContext.error) return <ErrorMessage msg={formContext.error} />;
 * 
 * // Access field values
 * const townId = formContext.values['Town']?.id;
 * 
 * // Access metadata
 * const fieldMeta = formContext.fieldMetadata.get(fieldId);
 * console.log(`Field ${fieldMeta?.label} has ${fieldMeta?.validationRules.length} rules`);
 * 
 * // Update field and trigger dependency resolution
 * await formContext.setFieldValue('Town', selectedTown);
 * 
 * // Check resolved dependency
 * const resolved = formContext.resolvedDependencies.get(ruleId);
 * if (resolved?.status === 'success') {
 *   // Use resource region from resolved dependency
 * }
 */
export function useEnrichedFormContext(
  config: FormConfigurationDto
): EnrichedFormContextType {
  const [values, setValues] = useState<Record<string, any>>({});
  const [fieldMetadata, setFieldMetadata] = useState<Map<number, FormFieldMetadata>>(new Map());
  const [entityMetadata, setEntityMetadata] = useState<Map<string, EntityMetadataDto>>(new Map());
  const [mergedEntityMetadata, setMergedEntityMetadata] = useState<Map<string, MergedEntityMetadata>>(new Map());
  const [resolvedDependencies, setResolvedDependencies] = useState<Map<number, ResolvedDependency>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logger = logging.getLogger('useEnrichedFormContext');

  /**
   * Build field metadata map from form configuration.
   * Extracts all fields across all steps and their validation rules.
   */
  const buildFieldMetadataMap = useCallback(async (formConfig: FormConfigurationDto): Promise<Map<number, FormFieldMetadata>> => {
    const metadata = new Map<number, FormFieldMetadata>();
    const allFields: FormFieldDto[] = [];

    // Flatten form structure: collect all fields
    const collectFields = (steps: FormStepDto[]) => {
      steps.forEach(step => {
        if (step.fields) {
          allFields.push(...step.fields);
        }
        if (step.childFormSteps && step.childFormSteps.length > 0) {
          collectFields(step.childFormSteps);
        }
      });
    };

    if (formConfig.steps) {
      collectFields(formConfig.steps);
    }

    // Load validation rules for all fields
    const fieldIds = allFields
      .filter(f => f.id && !f.id.toString().startsWith('temp'))
      .map(f => parseInt(f.id as string, 10));

    let allRules: FieldValidationRuleDto[] = [];
    if (fieldIds.length > 0 && formConfig.id) {
      try {
        allRules = await fieldValidationRuleClient.getByFormConfigurationId(parseInt(formConfig.id, 10));
      } catch (err) {
        logger.warn(`Failed to load validation rules for config ${formConfig.id}:`, err);
      }
    }

    // Build metadata for each field
    allFields.forEach(field => {
      if (!field.id) return;

      const fieldId = parseInt(field.id, 10);
      const rules = allRules.filter(rule => rule.formFieldId === fieldId);

      metadata.set(fieldId, {
        fieldId,
        fieldName: field.fieldName,
        label: field.label,
        fieldType: field.fieldType,
        objectType: field.objectType,
        validationRules: rules
      });
    });

    return metadata;
  }, []);

  /**
   * Load all entity metadata on component mount.
   */
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load field metadata from form configuration
        const fieldMeta = await buildFieldMetadataMap(config);
        setFieldMetadata(fieldMeta);

        // Load base entity metadata
        const baseMetadata = await metadataClient.getAllEntityMetadata();
        const metaMap = new Map(baseMetadata.map(m => [m.entityName, m]));
        setEntityMetadata(metaMap);

        logger.info(`Loaded metadata: ${fieldMeta.size} fields, ${metaMap.size} entities`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load metadata';
        setError(msg);
        logger.error('Failed to load enriched form context:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetadata();
  }, [config, buildFieldMetadataMap]);

  /**
   * Update a field value and trigger dependency resolution.
   */
  const setFieldValue = useCallback(async (fieldName: string, value: any) => {
    try {
      setValues(prev => ({ ...prev, [fieldName]: value }));
      
      // Find the field ID for this field name
      const fieldMeta = Array.from(fieldMetadata.values()).find(f => f.fieldName === fieldName);
      if (fieldMeta) {
        // Trigger dependency resolution for rules that depend on this field
        await resolveDependenciesBatch([fieldMeta.fieldId]);
      }
    } catch (err) {
      logger.error(`Failed to set field value for ${fieldName}:`, err);
      throw err;
    }
  }, [fieldMetadata]);

  /**
   * Resolve dependencies for a specific rule.
   */
  const resolveDependency = useCallback(async (ruleId: number): Promise<ResolvedDependency | null> => {
    try {
      const rule = Array.from(fieldMetadata.values())
        .flatMap(f => f.validationRules)
        .find(r => r.id === ruleId);

      if (!rule) {
        logger.warn(`Rule ${ruleId} not found`);
        return null;
      }

      // Resolve this single rule as a batch of one
      const response = await fieldValidationRuleClient.resolveDependencies({
        fieldIds: [rule.formFieldId],
        formContextSnapshot: values,
        formConfigurationId: config.id ? parseInt(config.id, 10) : undefined
      });

      if (response?.resolved && response.resolved[ruleId]) {
        const resolved = response.resolved[ruleId];
        setResolvedDependencies(prev => new Map(prev).set(ruleId, resolved));
        return resolved;
      }

      return null;
    } catch (err) {
      logger.error(`Failed to resolve dependency for rule ${ruleId}:`, err);
      return null;
    }
  }, [fieldMetadata, values, config.id]);

  /**
   * Resolve dependencies for multiple fields in a batch.
   */
  const resolveDependenciesBatch = useCallback(async (fieldIds: number[]): Promise<DependencyResolutionResponse | null> => {
    if (fieldIds.length === 0) return null;

    try {
      const response = await fieldValidationRuleClient.resolveDependencies({
        fieldIds,
        formContextSnapshot: values,
        formConfigurationId: config.id ? parseInt(config.id, 10) : undefined
      });

      if (response?.resolved) {
        // Update all resolved dependencies
        const newResolved = new Map(resolvedDependencies);
        Object.entries(response.resolved).forEach(([ruleId, resolved]) => {
          newResolved.set(parseInt(ruleId, 10), resolved);
        });
        setResolvedDependencies(newResolved);
      }

      return response;
    } catch (err) {
      logger.error('Failed to resolve dependencies batch:', err);
      return null;
    }
  }, [values, config.id, resolvedDependencies]);

  /**
   * Refresh all metadata and dependencies.
   */
  const refresh = useCallback(async () => {
    const fieldMeta = await buildFieldMetadataMap(config);
    setFieldMetadata(fieldMeta);

    // Re-resolve all dependencies
    const fieldIds = Array.from(fieldMeta.keys());
    await resolveDependenciesBatch(fieldIds);
  }, [config, buildFieldMetadataMap, resolveDependenciesBatch]);

  /**
   * Memoize metadata maps to prevent unnecessary re-renders.
   */
  const memoizedFieldMetadata = useMemo(() => fieldMetadata, [fieldMetadata]);
  const memoizedEntityMetadata = useMemo(() => entityMetadata, [entityMetadata]);
  const memoizedResolvedDependencies = useMemo(() => resolvedDependencies, [resolvedDependencies]);

  return {
    values,
    fieldMetadata: memoizedFieldMetadata,
    entityMetadata: memoizedEntityMetadata,
    mergedEntityMetadata,
    resolvedDependencies: memoizedResolvedDependencies,
    isLoading,
    error,
    setFieldValue,
    resolveDependency,
    resolveDependenciesBatch,
    refresh
  };
}
