import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import {
  EntityPropertySuggestion,
  PathValidationResult,
} from '../../types/dtos/forms/FieldValidationRuleDtos';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { logging } from '../../utils';

export type PathValidationStatus = 'pending' | 'success' | 'error';

export interface PathBuilderProps {
  /** Initial path to display (format: "Entity.Property") */
  initialPath?: string;
  /** The entity type being configured */
  entityTypeName: string;
  /** Called when path changes */
  onPathChange: (path: string) => void;
  /** Called when validation status changes */
  onValidationStatusChange?: (result: PathValidationResult) => void;
  /** Map of available entities from metadata */
  entityMetadata: Map<string, EntityMetadataDto>;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Label for the component */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
}

export const PathBuilder: React.FC<PathBuilderProps> = ({
  initialPath,
  entityTypeName,
  onPathChange,
  onValidationStatusChange,
  entityMetadata,
  disabled = false,
  className = '',
  label = 'Dependency Path',
  required = false,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [validationStatus, setValidationStatus] = useState<PathValidationStatus>('pending');
  const [validationResult, setValidationResult] = useState<PathValidationResult | null>(null);
  const [suggestions, setSuggestions] = useState<EntityPropertySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastNotifiedPath, setLastNotifiedPath] = useState<string>('');

  const logger = useMemo(() => logging.getLogger('PathBuilder'), []);

  // Parse initial path on mount
  useEffect(() => {
    if (initialPath && initialPath.includes('.')) {
      const [entity, property] = initialPath.split('.');
      setSelectedEntity(entity || '');
      setSelectedProperty(property || '');
    }
  }, [initialPath]);

  // Load suggestions when entity is selected
  useEffect(() => {
    const loadSuggestions = async () => {
      if (!selectedEntity) {
        setSuggestions([]);
        setSelectedProperty('');
        return;
      }

      try {
        setIsLoadingSuggestions(true);
        setError(null);
        const props = await fieldValidationRuleClient.getEntityProperties(selectedEntity);
        
        // Debug: Log raw response with details
        logger.debug(`Loaded ${props.length} properties for entity ${selectedEntity}`);
        console.log('Raw property suggestions from API:', props);
        console.log('Selected Entity:', selectedEntity);
        console.log('Disabled prop:', disabled);
        
        // Log first property to see structure
        if (props && props.length > 0) {
          console.log('First property structure:', props[0]);
          console.log('Property keys:', Object.keys(props[0]));
        }
        
        // Set all suggestions - don't filter aggressively
        // The API should return valid data
        setSuggestions(props || []);
        
        if (!props || props.length === 0) {
          logger.warn(`No properties returned for entity ${selectedEntity}`);
          console.warn('Property dropdown will be DISABLED because suggestions.length === 0');
        } else {
          console.log(`Property dropdown should be ${disabled ? 'DISABLED (parent disabled)' : 'ENABLED'} with ${props.length} options`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load properties';
        setError(`Failed to load properties: ${message}`);
        logger.error(`Error loading properties for ${selectedEntity}: ${message}`);
        console.error('Property loading error:', err);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    void loadSuggestions();
  }, [selectedEntity, logger]);

  // Validate path on change
  useEffect(() => {
    const validatePath = async () => {
      if (!selectedEntity || !selectedProperty) {
        setValidationStatus('pending');
        setValidationResult(null);
        return;
      }

      // Build path: if selectedEntity matches the form's entityTypeName, it's a self-reference
      // Use just the property name. Otherwise, use Entity.Property format.
      const isSelfReference = selectedEntity === entityTypeName;
      const path = isSelfReference ? selectedProperty : `${selectedEntity}.${selectedProperty}`;
      
      console.log(`Validating path: "${path}" (entityTypeName: "${entityTypeName}", selectedEntity: "${selectedEntity}", isSelfReference: ${isSelfReference})`);

      try {
        setIsValidating(true);
        setError(null);
        const result = await fieldValidationRuleClient.validatePath(path, entityTypeName);
        
        // Handle both camelCase and PascalCase from backend
        const isValid = (result as any).isValid ?? (result as any).IsValid ?? false;
        const errorMsg = (result as any).error || (result as any).ErrorMessage;
        
        setValidationStatus(isValid ? 'success' : 'error');
        setValidationResult(result);
        onValidationStatusChange?.(result);
        
        if (!isValid) {
          logger.warn(`Invalid path: ${path}. Reason: ${errorMsg}`);
          console.warn('Path validation failed:', result);
        } else {
          console.log('✓ Path validation succeeded:', path);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        setError(`Validation error: ${message}`);
        setValidationStatus('error');
        logger.error(`Error validating path: ${message}`);
      } finally {
        setIsValidating(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      void validatePath();
    }, 300); // Debounce validation

    return () => clearTimeout(debounceTimer);
  }, [selectedEntity, selectedProperty, entityTypeName, logger]);

  // Notify parent when path changes
  useEffect(() => {
    if (selectedEntity && selectedProperty && validationStatus === 'success') {
      // Build path: if selectedEntity matches the form's entityTypeName, it's a self-reference
      const isSelfReference = selectedEntity === entityTypeName;
      const path = isSelfReference ? selectedProperty : `${selectedEntity}.${selectedProperty}`;
      
      // Only notify if the path actually changed to prevent infinite loops
      if (path !== lastNotifiedPath) {
        console.log(`Notifying parent of path change: "${path}"`);
        setLastNotifiedPath(path);
        onPathChange(path);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntity, selectedProperty, validationStatus, entityTypeName]);

  const handleEntityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedEntity(value);
    setSelectedProperty(''); // Reset property when entity changes
  }, []);

  const handlePropertyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProperty(e.target.value);
  }, []);

  // Build display path
  const isSelfReference = selectedEntity === entityTypeName;
  const currentPath = selectedEntity && selectedProperty 
    ? (isSelfReference ? selectedProperty : `${selectedEntity}.${selectedProperty}`)
    : '';

  // Responsive classes
  const containerClass = `space-y-4 ${className}`;
  const dropdownBaseClass = `w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 transition-colors`;
  const dropdownNormalClass = `${dropdownBaseClass} border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-white`;
  const dropdownErrorClass = `${dropdownBaseClass} border-red-300 focus:ring-red-500 focus:border-red-500 bg-white`;
  const dropdownDisabledClass = `${dropdownBaseClass} border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed`;

  return (
    <div className={containerClass}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      </div>

      {/* Entity Selection */}
      <div className="space-y-1">
        <label htmlFor="entity-select" className="block text-xs font-medium text-gray-600 uppercase tracking-wider">
          Dependency Field (Entity)
        </label>
        <div className="relative">
          <select
            id="entity-select"
            value={selectedEntity}
            onChange={handleEntityChange}
            disabled={disabled}
            className={disabled ? dropdownDisabledClass : dropdownNormalClass}
            aria-label="Select dependency entity"
          >
            <option value="">Select a dependency field...</option>
            {Array.from(entityMetadata.values())
              .sort((a, b) => (a.displayName || a.entityName).localeCompare(b.displayName || b.entityName))
              .map((entity, index) => (
                <option key={`${entity.entityName}-${index}`} value={entity.entityName}>
                  {entity.displayName || entity.entityName}
                </option>
              ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Property Selection */}
      {selectedEntity && (
        <div className="space-y-1 animate-in fade-in">
          <label htmlFor="property-select" className="block text-xs font-medium text-gray-600 uppercase tracking-wider">
            Property
          </label>
          <div className="relative">
            {isLoadingSuggestions ? (
              <div className={`${dropdownDisabledClass} flex items-center text-gray-500`}>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading properties...
              </div>
            ) : (
              <>
                <select
                  id="property-select"
                  value={selectedProperty}
                  onChange={handlePropertyChange}
                  disabled={disabled || suggestions.length === 0}
                  className={disabled || suggestions.length === 0 ? dropdownDisabledClass : dropdownNormalClass}
                  aria-label="Select property"
                  style={{ zIndex: 10, position: 'relative', pointerEvents: 'auto' }}
                >
                  <option value="">Select a property...</option>
                  {suggestions.map((suggestion, index) => {
                    // Handle both camelCase (propertyName) and PascalCase (PropertyName) from backend
                    const propName = (suggestion as any).propertyName || (suggestion as any).PropertyName || `property_${index}`;
                    const propType = (suggestion as any).propertyType || (suggestion as any).PropertyType || '';
                    const propDesc = (suggestion as any).description || (suggestion as any).Description || '';
                    return (
                      <option 
                        key={`${propName}-${index}`} 
                        value={propName} 
                        title={propDesc || undefined}
                      >
                        {propName}
                        {propType && ` (${propType})`}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" style={{ zIndex: 5 }} />
              </>
            )}
          </div>
          {suggestions.length === 0 && !isLoadingSuggestions && selectedEntity && (
            <p className="text-xs text-yellow-600">No properties available for this entity. This may indicate a backend configuration issue.</p>
          )}
          {suggestions.length === 0 && !isLoadingSuggestions && selectedEntity && error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
      )}

      {/* Path Preview and Validation Status */}
      {currentPath && (
        <div className={`mt-4 p-3 rounded-md border transition-all ${
          validationStatus === 'success'
            ? 'border-green-200 bg-green-50'
            : validationStatus === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 mb-1">Generated Path:</p>
              <p className="font-mono text-sm font-semibold text-gray-900 break-all">
                {currentPath}
              </p>
              {isSelfReference && validationStatus === 'success' && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ Same-entity reference: refers to the <strong>{entityTypeName}</strong> property on the same form entity
                </p>
              )}
              {!isSelfReference && validationStatus === 'success' && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ Cross-entity reference: refers to the related <strong>{selectedEntity}</strong> entity
                </p>
              )}
              {validationResult?.detailedError && (
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {validationResult.detailedError}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 mt-1">
              {isValidating ? (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              ) : validationStatus === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : validationStatus === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : null}
            </div>
          </div>
          {validationStatus === 'success' && (
            <p className="text-xs text-green-700 mt-2 font-medium">✓ Valid path</p>
          )}
          {validationStatus === 'error' && validationResult?.error && (
            <p className="text-xs text-red-700 mt-2 font-medium">✗ {validationResult.error}</p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && !currentPath && (
        <div className="p-3 rounded-md border border-red-200 bg-red-50 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PathBuilder;
