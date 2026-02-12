import { renderHook, act, waitFor } from '@testing-library/react';
import { useEnrichedFormContext, EnrichedFormContextType, FormFieldMetadata } from '../useEntityMetadata';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';
import { FieldValidationRuleDto, DependencyResolutionResponse } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import * as fieldValidationRuleClient from '../../apiClients/fieldValidationRuleClient';
import * as metadataClient from '../../apiClients/metadataClient';

// Mock API clients
jest.mock('../../apiClients/fieldValidationRuleClient');
jest.mock('../../apiClients/metadataClient');

const mockFieldValidationRuleClient = fieldValidationRuleClient as jest.Mocked<typeof fieldValidationRuleClient>;
const mockMetadataClient = metadataClient as jest.Mocked<typeof metadataClient>;

describe('useEnrichedFormContext', () => {
  const mockEntityMetadata: EntityMetadataDto[] = [
    {
      entityName: 'Town',
      displayName: 'Town',
      fields: [
        { fieldName: 'id', fieldType: 'Integer', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'wgRegionId', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false }
      ]
    },
    {
      entityName: 'Location',
      displayName: 'Location',
      fields: [
        { fieldName: 'id', fieldType: 'Integer', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'x', fieldType: 'Decimal', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'z', fieldType: 'Decimal', isNullable: false, isRelatedEntity: false, hasDefaultValue: false }
      ]
    }
  ];

  const mockValidationRule: FieldValidationRuleDto = {
    id: 1,
    formFieldId: 2,
    validationType: 'LocationInsideRegion',
    dependsOnFieldId: 1,
    dependencyPath: 'Town.wgRegionId',
    configJson: '{"regionPropertyPath":"WgRegionId"}',
    errorMessage: 'Location is outside {Town.name} boundaries',
    successMessage: 'Location is valid',
    isBlocking: true,
    requiresDependencyFilled: true,
    createdAt: new Date().toISOString()
  };

  const mockFormConfiguration: FormConfigurationDto = {
    id: '1',
    entityTypeName: 'District',
    configurationName: 'District Form',
    description: 'Form to create districts',
    isDefault: true,
    isActive: true,
    steps: [
      {
        id: '1',
        formConfigurationId: '1',
        stepName: 'basic-info',
        title: 'Basic Information',
        order: 0,
        fields: [
          {
            id: '1',
            formStepId: '1',
            fieldName: 'Town',
            label: 'Town',
            fieldType: 'Object',
            isRequired: true,
            isReadOnly: false,
            order: 0,
            objectType: 'Town',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            validations: []
          },
          {
            id: '2',
            formStepId: '1',
            fieldName: 'Location',
            label: 'Location',
            fieldType: 'Object',
            isRequired: true,
            isReadOnly: false,
            order: 1,
            objectType: 'Location',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            validations: []
          }
        ] as FormFieldDto[],
        childFormSteps: [],
        isReusable: false,
        isManyToManyRelationship: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false
      } as FormStepDto
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMetadataClient.metadataClient.getAllEntityMetadata.mockResolvedValue(mockEntityMetadata);
    mockFieldValidationRuleClient.fieldValidationRuleClient.getByFormConfigurationId.mockResolvedValue([mockValidationRule]);
    mockFieldValidationRuleClient.fieldValidationRuleClient.resolveDependencies.mockResolvedValue({
      resolved: {
        1: {
          ruleId: 1,
          status: 'success',
          resolvedValue: 'town_1',
          dependencyPath: 'Town.wgRegionId',
          resolvedAt: new Date().toISOString(),
          message: 'Successfully resolved'
        }
      },
      resolvedAt: new Date().toISOString()
    });
  });

  describe('initialization', () => {
    it('should load field and entity metadata on mount', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fieldMetadata.size).toBeGreaterThan(0);
      expect(result.current.entityMetadata.size).toBeGreaterThan(0);
      expect(mockMetadataClient.metadataClient.getAllEntityMetadata).toHaveBeenCalled();
    });

    it('should handle initialization error gracefully', async () => {
      mockMetadataClient.metadataClient.getAllEntityMetadata.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.fieldMetadata.size).toBe(0);
    });
  });

  describe('field value management', () => {
    it('should set field value and trigger dependency resolution', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const townValue = { id: 1, name: 'Cinix', wgRegionId: 'town_1' };

      await act(async () => {
        await result.current.setFieldValue('Town', townValue);
      });

      expect(result.current.values['Town']).toEqual(townValue);
    });

    it('should handle setFieldValue errors', async () => {
      mockFieldValidationRuleClient.fieldValidationRuleClient.resolveDependencies.mockRejectedValue(
        new Error('Resolution failed')
      );

      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.setFieldValue('Town', { id: 1 });
        } catch (err) {
          // Expected
        }
      });
    });
  });

  describe('dependency resolution', () => {
    it('should resolve single dependency', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let resolved;
      await act(async () => {
        resolved = await result.current.resolveDependency(1);
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.status).toBe('success');
      expect(resolved?.resolvedValue).toBe('town_1');
    });

    it('should resolve dependencies batch', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let response;
      await act(async () => {
        response = await result.current.resolveDependenciesBatch([1, 2]);
      });

      expect(response).not.toBeNull();
      expect(response?.resolved).toBeDefined();
      expect(mockFieldValidationRuleClient.fieldValidationRuleClient.resolveDependencies).toHaveBeenCalled();
    });

    it('should handle empty field IDs', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let response;
      await act(async () => {
        response = await result.current.resolveDependenciesBatch([]);
      });

      expect(response).toBeNull();
    });

    it('should return null for non-existent rule', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let resolved;
      await act(async () => {
        resolved = await result.current.resolveDependency(9999);
      });

      expect(resolved).toBeNull();
    });
  });

  describe('metadata caching', () => {
    it('should memoize field metadata to prevent unnecessary re-renders', async () => {
      const { result, rerender } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const fieldMeta1 = result.current.fieldMetadata;

      // Re-render with same config
      rerender();

      const fieldMeta2 = result.current.fieldMetadata;

      // Should be same reference if not re-computed
      expect(fieldMeta1).toBe(fieldMeta2);
    });

    it('should memoize resolved dependencies', async () => {
      const { result, rerender } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const deps1 = result.current.resolvedDependencies;

      rerender();

      const deps2 = result.current.resolvedDependencies;

      expect(deps1).toBe(deps2);
    });
  });

  describe('refresh', () => {
    it('should reload metadata and dependencies', async () => {
      const { result } = renderHook(() => useEnrichedFormContext(mockFormConfiguration));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockMetadataClient.metadataClient.getAllEntityMetadata.mock.callCount;

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockMetadataClient.metadataClient.getAllEntityMetadata.mock.callCount).toBeGreaterThan(initialCallCount);
    });
  });
});
