import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink, ChevronDown, ChevronRight, MapPin, Building2, Home, Brackets, Hash, Database, Map as MapIcon } from 'lucide-react';
import { DistrictViewDTO } from '../types/dtos/district/DistrictViewDTO';
import { objectConfigs } from '../config/objectConfigs';
import { ObjectConfig } from '../types/common';

interface TypeBadgeProps {
  type: string;
  count?: number;
}

function TypeBadge({ type, count }: TypeBadgeProps) {
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
      {type}
      {count !== undefined && (
        <span className="ml-1 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </span>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  type?: string;
  count?: number;
  defaultExpanded?: boolean;
}

function CollapsibleSection({ title, icon, type, count, children, defaultExpanded = false }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
      >
        <span className="flex items-center space-x-3">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="font-medium text-gray-900">{title}</span>
          {type && <TypeBadge type={type} count={count} />}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 bg-white border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

interface ObjectViewProps {
  data: Record<string, any>;
  config: Record<string, any>;
  parentField?: string;
  parentConfig?: ObjectConfig;
}

interface RelatedEntityProps {
  title: string;
  icon: React.ReactNode;
  data: any;
  fields: Record<string, any>;
  fieldDisplayMode?: 'all' | 'idAndName' | 'nameOnly';
  onViewDetails?: () => void;
}

function RelatedEntity({ title, icon, data, fields, fieldDisplayMode = 'all', onViewDetails }: RelatedEntityProps) {
  if (!data) return null;

  const shouldShowField = (key: string): boolean => {
    switch (fieldDisplayMode) {
      case 'nameOnly':
        return key.toLowerCase() === 'name';
      case 'idAndName':
        return key.toLowerCase() === 'name' || key.toLowerCase() === 'id';
      case 'all':
      default:
        return true;
    }
  };

  return (
    <CollapsibleSection title={title} icon={icon} defaultExpanded={true}>
      <div className="space-y-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(data).map(([key, value]) => {
            const field = fields[key];
            if (!field || !shouldShowField(key)) return null;

            return (
              <div key={key} className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">{field.label || key}</dt>
                <dd className="mt-1 text-sm text-gray-900">{renderValue(key, value)}</dd>
              </div>
            );
          })}
        </dl>
        {onViewDetails && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onViewDetails}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View Details
              <ExternalLink className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function isDistrictViewDTO(value: any): value is DistrictViewDTO {
  return value && 
         typeof value === 'object' && 
         'StreetNames' in value &&
         value.StreetNames instanceof Map;
}

function renderStreetNamesMap(streetNames: Map<number, string>): React.ReactNode {
  if (!streetNames || streetNames.size === 0) {
    return <span className="text-gray-400">No streets assigned</span>;
  }

  return (
    <CollapsibleSection
      title="Street Names"
      type={`Map<number, string>`}
      count={streetNames.size}
      icon={<MapIcon className="h-4 w-4" />}
      defaultExpanded={true}
    >
      <div className="space-y-2">
        {Array.from(streetNames.entries()).map(([id, name]) => (
          <div key={id} className="flex items-center space-x-2">
            <span className="text-gray-500 font-mono">{id}</span>
            <span className="text-gray-400">→</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {name}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function renderComplexValue(value: any, indent: number = 0): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }

  // Handle DistrictViewDTO's StreetNames map
  if (isDistrictViewDTO(value) && value.StreetNames) {
    return renderStreetNamesMap(value.StreetNames);
  }

  if (Array.isArray(value)) {
    const elementType = value.length > 0 ? typeof value[0] : 'unknown';
    return (
      <CollapsibleSection 
        title="Array" 
        type={`${elementType}[]`}
        count={value.length}
        icon={<Brackets className="h-4 w-4" />}
      >
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={index} className="flex">
              <span className="text-gray-500 mr-2 font-mono">[{index}]</span>
              <div className="flex-1">{renderComplexValue(item, indent + 1)}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  if (value instanceof Map) {
    const [firstKey, firstValue] = value.size > 0 ? Array.from(value.entries())[0] : [null, null];
    const keyType = firstKey !== null ? typeof firstKey : 'unknown';
    const valueType = firstValue !== null ? typeof firstValue : 'unknown';

    return (
      <CollapsibleSection 
        title="Map" 
        type={`Map<${keyType}, ${valueType}>`}
        count={value.size}
        icon={<Hash className="h-4 w-4" />}
      >
        <div className="space-y-2">
          {Array.from(value.entries()).map(([key, val], index) => (
            <div key={index} className="flex">
              <span className="text-gray-500 mr-2 font-mono">{key} →</span>
              <div className="flex-1">{renderComplexValue(val, indent + 1)}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  if (value instanceof Set) {
    const elementType = value.size > 0 ? typeof Array.from(value)[0] : 'unknown';
    return (
      <CollapsibleSection 
        title="Set" 
        type={`Set<${elementType}>`}
        count={value.size}
        icon={<Database className="h-4 w-4" />}
      >
        <div className="space-y-2">
          {Array.from(value).map((item, index) => (
            <div key={index} className="flex">
              <span className="text-gray-500 mr-2 font-mono">•</span>
              <div className="flex-1">{renderComplexValue(item, indent + 1)}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  if (typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      return <span className="text-gray-400">Empty object</span>;
    }

    return (
      <CollapsibleSection
        title="Object"
        type={value.constructor.name}
        count={Object.keys(value).length}
        icon={<Database className="h-4 w-4" />}
      >
        <div className="space-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="flex">
              <span className="text-gray-500 mr-2 font-mono">{key}:</span>
              <div className="flex-1">{renderComplexValue(val, indent + 1)}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  return <span>{String(value)}</span>;
}

function renderValue(key: string, value: any, formatter?: (value: any) => React.ReactNode): React.ReactNode {
  if (formatter) {
    return formatter(value);
  }

  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }

  // Special handling for Name field
  if (key === 'name' || key === 'Name') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
        {value}
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  // Handle complex types
  if (
    typeof value === 'object' ||
    Array.isArray(value) ||
    value instanceof Map ||
    value instanceof Set
  ) {
    return renderComplexValue(value);
  }

  return String(value);
}

export function ObjectView({ data, config }: ObjectViewProps) {
  const navigate = useNavigate();

  const renderField = (key: string, value: any, field: any) => {
    // Skip hidden fields or fields that don't match display mode
    if (field.hidden || (config.fieldDisplayConfig?.[key]?.fieldDisplayMode === 'none')) {
      return null;
    }
    
    // Handle special related entities
    if (field.type === 'object' && value && field.objectConfig) {
      const entityConfig = objectConfigs[field.objectConfig.type];
      if (!entityConfig) return null;

      const fieldDisplayMode = config.fieldDisplayConfig?.[key]?.fieldDisplayMode || 'all';

      let icon;
      switch (field.objectConfig.type) {
        case 'district':
          icon = <MapPin />;
          break;
        case 'structure':
          icon = <Building2 />;
          break;
        case 'town':
          icon = <Home />;
          break;
        default:
          icon = null;
      }

      return (
        <div key={key} className="col-span-2 mt-8">
          <RelatedEntity
            title={`${field.label} Information`}
            icon={icon}
            data={value}
            fields={entityConfig.fields}
            fieldDisplayMode={fieldDisplayMode}
            onViewDetails={
              field.showViewButton !== false
                ? () => navigate(`/view/${field.objectConfig.type}/${value.id}`)
                : undefined
            }
          />
        </div>
      );
    }

    // Handle arrays and other complex types
    if (field.type === 'array' || (typeof value === 'object' && value !== null)) {
      return (
        <div key={key} className="col-span-2 space-y-2">
          <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
          <dd className="mt-1">
            {renderValue(key, value, config.formatters?.[key])}
          </dd>
        </div>
      );
    }

    return (
      <div key={key} className="sm:col-span-1">
        <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
        <dd className="mt-1 text-sm text-gray-900">
          {renderValue(key, value, config.formatters?.[key])}
        </dd>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-secondary"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </button>
      </div>

      <div className="panel space-y-6">
        <div className="px-4 py-5 sm:px-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {data.Name || config.label} Details
          </h2>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            {Object.entries(config.fields).map(([key, field]: [string, any]) => 
              renderField(key, data[key], field)
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

