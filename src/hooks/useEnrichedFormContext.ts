import { useCallback, useEffect, useMemo, useState } from 'react';
import { fieldValidationRuleClient } from '../apiClients/fieldValidationRuleClient';
import { metadataClient } from '../apiClients/metadataClient';
import {
  DependencyResolutionResponse,
  ResolvedDependency,
  ValidationIssueDto,
} from '../types/dtos/forms/FieldValidationRuleDtos';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../types/dtos/forms/FormModels';
import { EntityMetadataDto } from '../types/dtos/metadata/MetadataModels';
import { logging } from '../utils';

export interface FormFieldMetadata {
  id: number;
  fieldName: string;
  label?: string;
  fieldType?: string;
  stepId?: number;
  stepName?: string;
}

export type EntityMetadataMap = Map<string, EntityMetadataDto>;

export interface EnrichedFormContextType {
  values: Record<string, any>;
  fieldMetadata: Map<number, FormFieldMetadata>;
  entityMetadata: EntityMetadataMap;
  resolvedDependencies: Map<number, ResolvedDependency>;
  isLoading: boolean;
  error: string | null;
  setFieldValue: (fieldName: string, value: any) => void;
  resolveDependency: (ruleId: number) => Promise<ResolvedDependency>;
  resolveDependenciesBatch: (fieldIds: number[], contextSnapshot?: Record<string, any>) => Promise<DependencyResolutionResponse>;
}

const createEmptyResolutionResponse = (): DependencyResolutionResponse => ({
  resolved: {},
  resolvedAt: new Date().toISOString(),
});

export const useEnrichedFormContext = (config: FormConfigurationDto): EnrichedFormContextType => {
  const [values, setValues] = useState<Record<string, any>>({});
  const [fieldMetadata, setFieldMetadata] = useState<Map<number, FormFieldMetadata>>(new Map());
  const [entityMetadata, setEntityMetadata] = useState<EntityMetadataMap>(new Map());
  const [resolvedDependencies, setResolvedDependencies] = useState<Map<number, ResolvedDependency>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fieldMeta = buildFieldMetadataMap(config);
        const entityMeta = await metadataClient.getAllEntityMetadata();

        setFieldMetadata(fieldMeta);
        setEntityMetadata(new Map(entityMeta.map(entity => [entity.entityName, entity])));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load metadata';
        setError(`Failed to load metadata: ${message}`);
        logging.errorHandler.next('ErrorMessage.FormMetadata.LoadFailed');
      } finally {
        setIsLoading(false);
      }
    };

    void loadMetadata();
  }, [config]);

  const resolveDependenciesBatch = useCallback(async (
    fieldIds: number[],
    contextSnapshot?: Record<string, any>
  ): Promise<DependencyResolutionResponse> => {
    if (!fieldIds.length) {
      return createEmptyResolutionResponse();
    }

    const formConfigurationId = parseOptionalNumber(config.id);
    const formContextSnapshot = contextSnapshot ?? values;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fieldValidationRuleClient.resolveDependencies({
        fieldIds,
        formContextSnapshot,
        formConfigurationId,
      });

      const resolved = response?.resolved ?? {};
      const resolvedMap = new Map<number, ResolvedDependency>(
        Object.values(resolved).map(item => [item.ruleId, item])
      );
      setResolvedDependencies(resolvedMap);

      if (response?.issues?.length) {
        const issueSummary = summarizeIssues(response.issues);
        setError(issueSummary);
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve dependencies';
      setError(`Failed to resolve dependencies: ${message}`);
      logging.errorHandler.next('ErrorMessage.FormDependencies.ResolveFailed');
      return createEmptyResolutionResponse();
    } finally {
      setIsLoading(false);
    }
  }, [config.id, values]);

  const setFieldValue = useCallback((fieldName: string, value: any) => {
    try {
      setValues(prev => {
        const next = { ...prev, [fieldName]: value };
        const fieldIds = Array.from(fieldMetadata.keys());
        void resolveDependenciesBatch(fieldIds, next);
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set field value';
      setError(`Failed to set field value: ${message}`);
      logging.errorHandler.next('ErrorMessage.FormContext.UpdateFailed');
    }
  }, [fieldMetadata, resolveDependenciesBatch]);

  const resolveDependency = useCallback(async (ruleId: number): Promise<ResolvedDependency> => {
    const existing = resolvedDependencies.get(ruleId);
    if (existing) {
      return existing;
    }

    const fieldIds = Array.from(fieldMetadata.keys());
    const response = await resolveDependenciesBatch(fieldIds);
    const resolved = response.resolved?.[ruleId];

    return resolved ?? {
      ruleId,
      status: 'error',
      dependencyPath: '',
      resolvedAt: new Date().toISOString(),
      message: 'Dependency could not be resolved.',
    };
  }, [fieldMetadata, resolvedDependencies, resolveDependenciesBatch]);

  const cachedFieldMetadata = useMemo(() => fieldMetadata, [fieldMetadata]);
  const cachedEntityMetadata = useMemo(() => entityMetadata, [entityMetadata]);
  const cachedResolvedDependencies = useMemo(() => resolvedDependencies, [resolvedDependencies]);

  return {
    values,
    fieldMetadata: cachedFieldMetadata,
    entityMetadata: cachedEntityMetadata,
    resolvedDependencies: cachedResolvedDependencies,
    isLoading,
    error,
    setFieldValue,
    resolveDependency,
    resolveDependenciesBatch,
  };
};

const buildFieldMetadataMap = (config: FormConfigurationDto): Map<number, FormFieldMetadata> => {
  const map = new Map<number, FormFieldMetadata>();
  const steps = flattenSteps(config.steps ?? []);

  steps.forEach(step => {
    (step.fields ?? []).forEach(field => {
      const id = parseOptionalNumber(field.id);
      if (!id) {
        return;
      }
      map.set(id, {
        id,
        fieldName: field.fieldName,
        label: field.label,
        fieldType: field.fieldType,
        stepId: parseOptionalNumber(step.id) ?? undefined,
        stepName: step.stepName,
      });
    });
  });

  return map;
};

const flattenSteps = (steps: FormStepDto[]): FormStepDto[] => {
  const flattened: FormStepDto[] = [];

  steps.forEach(step => {
    flattened.push(step);
    if (step.childFormSteps?.length) {
      flattened.push(...flattenSteps(step.childFormSteps));
    }
  });

  return flattened;
};

const parseOptionalNumber = (value?: string | number): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const summarizeIssues = (issues: ValidationIssueDto[]): string => {
  const summaries = issues
    .slice(0, 3)
    .map(issue => issue.message)
    .filter(Boolean);

  if (!summaries.length) {
    return 'Configuration validation issues detected.';
  }

  return summaries.length === issues.length
    ? summaries.join(' | ')
    : `${summaries.join(' | ')} | +${issues.length - summaries.length} more`;
};
