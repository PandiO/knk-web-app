import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { objectConfigs } from '../config/objectConfigs';

interface ObjectViewProps {
  data: Record<string, any>;
  config: Record<string, any>;
}

export function ObjectView({ data, config }: ObjectViewProps) {
  const navigate = useNavigate();

  const renderValue = (key: string, value: any, formatter?: (value: any) => React.ReactNode) => {
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

    return value.toString();
  };

  const renderRelatedEntity = (key: string, value: any, field: any) => {
    if (!value) return null;

    const entityConfig = field.objectConfig;
    if (!entityConfig) return null;

    return (
      <div key={key} className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {field.label} Information
        </h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.entries(value).map(([subKey, subValue]) => {
              // Skip internal or complex fields
              if (
                subKey === 'Id' ||
                typeof subValue === 'object' ||
                Array.isArray(subValue)
              ) {
                return null;
              }

              const subField = entityConfig.fields[subKey];
              if (!subField) return null;

              return (
                <div key={subKey} className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">
                    {subField.label}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {renderValue(subKey, subValue, entityConfig.formatters?.[subKey])}
                  </dd>
                </div>
              );
            })}
          </dl>
          {field.showViewButton !== false && (
            <div className="mt-4">
              <button
                onClick={() => navigate(`/view/${entityConfig.type}/${value.Id}`)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                View Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </button>
      </div>

      <div className="panel">
        <div className="px-4 py-5 sm:px-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {data.Name || config.label} Details
          </h2>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            {Object.entries(config.fields).map(([key, field]: [string, any]) => {
              const value = data[key];

              // Skip hidden fields
              if (field.hidden) return null;

              // Handle related entities separately
              if (field.type === 'object' || field.type === 'array') {
                return renderRelatedEntity(key, value, field);
              }

              // Skip complex objects without formatters
              if (typeof value === 'object' && !config.formatters?.[key]) {
                return null;
              }

              return (
                <div key={key} className="sm:col-span-1">
                  <dt className="text-sm font-medium text-slate-500">
                    {field.label}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {renderValue(key, value, config.formatters?.[key])}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </div>
  );
}