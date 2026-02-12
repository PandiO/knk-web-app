import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, X, Search, AlertCircle, CheckCircle } from 'lucide-react';
import {
  EntityPropertySuggestion,
  PathValidationResult,
} from '../../types/dtos/forms/FieldValidationRuleDtos';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import { logging } from '../../utils';

export type PathValidationStatus = 'pending' | 'success' | 'error';

export interface SearchablePathBuilderProps {
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

export const SearchablePathBuilder: React.FC<SearchablePathBuilderProps> = ({
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
  const [entitySearchTerm, setEntitySearchTerm] = useState<string>('');
  const [propertySearchTerm, setPropertySearchTerm] = useState<string>('');
  const [isEntityDropdownOpen, setIsEntityDropdownOpen] = useState(false);
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);
  const [highlightedEntityIndex, setHighlightedEntityIndex] = useState(0);
  const [highlightedPropertyIndex, setHighlightedPropertyIndex] = useState(0);
  const [validationStatus, setValidationStatus] = useState<PathValidationStatus>('pending');
  const [validationResult, setValidationResult] = useState<PathValidationResult | null>(null);
  const [suggestions, setSuggestions] = useState<EntityPropertySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityDropdownRef = useRef<HTMLDivElement>(null);
  const propertyDropdownRef = useRef<HTMLDivElement>(null);
  const entitySearchInputRef = useRef<HTMLInputElement>(null);
  const propertySearchInputRef = useRef<HTMLInputElement>(null);

  const logger = useMemo(() => logging.getLogger('SearchablePathBuilder'), []);

  // Parse initial path on mount
  useEffect(() => {
    if (initialPath && initialPath.includes('.')) {
      const [entity, property] = initialPath.split('.');
      setSelectedEntity(entity || '');
      setSelectedProperty(property || '');
    }
  }, [initialPath]);

  // Filter entities based on search term
  const filteredEntities = useMemo(() => {
    const searchTerm = entitySearchTerm.toLowerCase();
    return Array.from(entityMetadata.values())
      .filter((entity) =>
        entity.displayName?.toLowerCase().includes(searchTerm) ||
        entity.entityName.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => (a.displayName || a.entityName).localeCompare(b.displayName || b.entityName));
  }, [entityMetadata, entitySearchTerm]);

  // Filter properties based on search term
  const filteredProperties = useMemo(() => {
    const searchTerm = propertySearchTerm.toLowerCase();
    return suggestions.filter((prop) =>
      prop.propertyName.toLowerCase().includes(searchTerm) ||
      prop.description?.toLowerCase().includes(searchTerm)
    );
  }, [suggestions, propertySearchTerm]);

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
        setSuggestions(props);
        logger.debug(`Loaded ${props.length} properties for entity ${selectedEntity}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load properties';
        setError(`Failed to load properties: ${message}`);
        logger.error(`Error loading properties for ${selectedEntity}: ${message}`);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    void loadSuggestions();
  }, [selectedEntity, logger]);

  // Validate path on change with debounce
  useEffect(() => {
    const validatePath = async () => {
      if (!selectedEntity || !selectedProperty) {
        setValidationStatus('pending');
        setValidationResult(null);
        return;
      }

      const path = `${selectedEntity}.${selectedProperty}`;

      try {
        setIsValidating(true);
        setError(null);
        const result = await fieldValidationRuleClient.validatePath(path, entityTypeName);

        setValidationStatus(result.isValid ? 'success' : 'error');
        setValidationResult(result);
        onValidationStatusChange?.(result);

        if (!result.isValid) {
          logger.warn(`Invalid path: ${path}. Reason: ${result.error}`);
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
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [selectedEntity, selectedProperty, entityTypeName, onValidationStatusChange, logger]);

  // Notify parent when path changes
  useEffect(() => {
    if (selectedEntity && selectedProperty && validationStatus === 'success') {
      onPathChange(`${selectedEntity}.${selectedProperty}`);
    }
  }, [selectedEntity, selectedProperty, validationStatus, onPathChange]);

  // Handle click outside for entity dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(event.target as Node)) {
        setIsEntityDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle click outside for property dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (propertyDropdownRef.current && !propertyDropdownRef.current.contains(event.target as Node)) {
        setIsPropertyDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isEntityDropdownOpen && entitySearchInputRef.current) {
      entitySearchInputRef.current.focus();
    }
  }, [isEntityDropdownOpen]);

  useEffect(() => {
    if (isPropertyDropdownOpen && propertySearchInputRef.current) {
      propertySearchInputRef.current.focus();
    }
  }, [isPropertyDropdownOpen]);

  // Handle entity keyboard navigation
  const handleEntityKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedEntityIndex((prev) =>
          prev < filteredEntities.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedEntityIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredEntities[highlightedEntityIndex]) {
          setSelectedEntity(filteredEntities[highlightedEntityIndex].entityName);
          setIsEntityDropdownOpen(false);
          setEntitySearchTerm('');
        }
        break;
      case 'Escape':
        setIsEntityDropdownOpen(false);
        break;
    }
  };

  // Handle property keyboard navigation
  const handlePropertyKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedPropertyIndex((prev) =>
          prev < filteredProperties.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedPropertyIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredProperties[highlightedPropertyIndex]) {
          setSelectedProperty(filteredProperties[highlightedPropertyIndex].propertyName);
          setIsPropertyDropdownOpen(false);
          setPropertySearchTerm('');
        }
        break;
      case 'Escape':
        setIsPropertyDropdownOpen(false);
        break;
    }
  };

  const currentPath = selectedEntity && selectedProperty ? `${selectedEntity}.${selectedProperty}` : '';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      </div>

      {/* Entity Selection */}
      <div className="relative" ref={entityDropdownRef}>
        <label htmlFor="entity-search" className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
          Dependency Field (Entity)
        </label>
        <button
          type="button"
          onClick={() => {
            setIsEntityDropdownOpen(!isEntityDropdownOpen);
            setHighlightedEntityIndex(0);
          }}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-md shadow-sm text-left text-sm flex items-center justify-between ${
            disabled ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300 bg-white hover:border-gray-400'
          } focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
        >
          <span className={selectedEntity ? 'text-gray-900' : 'text-gray-500'}>
            {selectedEntity || 'Select a dependency field...'}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isEntityDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isEntityDropdownOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 overflow-hidden">
            <div className="sticky top-0 bg-white px-2 py-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  ref={entitySearchInputRef}
                  type="text"
                  id="entity-search"
                  placeholder="Search entities..."
                  value={entitySearchTerm}
                  onChange={(e) => {
                    setEntitySearchTerm(e.target.value);
                    setHighlightedEntityIndex(0);
                  }}
                  onKeyDown={handleEntityKeyDown}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredEntities.map((entity, index) => (
                <button
                  key={entity.entityName}
                  type="button"
                  onClick={() => {
                    setSelectedEntity(entity.entityName);
                    setIsEntityDropdownOpen(false);
                    setEntitySearchTerm('');
                  }}
                  onMouseEnter={() => setHighlightedEntityIndex(index)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 ${
                    highlightedEntityIndex === index
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-900 hover:bg-gray-50'
                  } transition-colors`}
                >
                  <div className="font-medium">{entity.displayName || entity.entityName}</div>
                  {entity.description && (
                    <div className="text-xs text-gray-500 mt-0.5">{entity.description}</div>
                  )}
                </button>
              ))}

              {filteredEntities.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No entities found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Property Selection */}
      {selectedEntity && (
        <div className="relative animate-in fade-in" ref={propertyDropdownRef}>
          <label htmlFor="property-search" className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
            Property
          </label>
          <button
            type="button"
            onClick={() => {
              setIsPropertyDropdownOpen(!isPropertyDropdownOpen);
              setHighlightedPropertyIndex(0);
            }}
            disabled={disabled || isLoadingSuggestions || suggestions.length === 0}
            className={`w-full px-3 py-2 border rounded-md shadow-sm text-left text-sm flex items-center justify-between ${
              disabled || suggestions.length === 0
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                : 'border-gray-300 bg-white hover:border-gray-400'
            } focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
          >
            <span className={selectedProperty ? 'text-gray-900' : 'text-gray-500'}>
              {isLoadingSuggestions ? 'Loading properties...' : selectedProperty || 'Select a property...'}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isPropertyDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPropertyDropdownOpen && !isLoadingSuggestions && (
            <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 overflow-hidden">
              <div className="sticky top-0 bg-white px-2 py-2 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    ref={propertySearchInputRef}
                    type="text"
                    id="property-search"
                    placeholder="Search properties..."
                    value={propertySearchTerm}
                    onChange={(e) => {
                      setPropertySearchTerm(e.target.value);
                      setHighlightedPropertyIndex(0);
                    }}
                    onKeyDown={handlePropertyKeyDown}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {filteredProperties.map((prop, index) => (
                  <button
                    key={prop.propertyName}
                    type="button"
                    onClick={() => {
                      setSelectedProperty(prop.propertyName);
                      setIsPropertyDropdownOpen(false);
                      setPropertySearchTerm('');
                    }}
                    onMouseEnter={() => setHighlightedPropertyIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 ${
                      highlightedPropertyIndex === index
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-gray-900 hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{prop.propertyName}</span>
                      {prop.propertyType && (
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          {prop.propertyType}
                        </span>
                      )}
                    </div>
                    {prop.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{prop.description}</div>
                    )}
                  </button>
                ))}

                {filteredProperties.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                    No properties found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Path Preview and Validation Status */}
      {currentPath && (
        <div
          className={`mt-4 p-3 rounded-md border transition-all ${
            validationStatus === 'success'
              ? 'border-green-200 bg-green-50'
              : validationStatus === 'error'
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 mb-1">Generated Path:</p>
              <p className="font-mono text-sm font-semibold text-gray-900 break-all">
                {currentPath}
              </p>
              {validationResult?.detailedError && (
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {validationResult.detailedError}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 mt-1">
              {isValidating ? (
                <div className="h-5 w-5 text-blue-500 animate-spin">⟳</div>
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

export default SearchablePathBuilder;
