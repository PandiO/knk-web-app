import React, { useEffect, useState } from 'react';
import { objectConfigs } from '../config/objectConfigs';
import { DistrictManager } from '../apiClients/districts';
import { StreetManager } from '../apiClients/streets';
import type { FormField, ObjectConfig } from '../types/common';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { SearchableDropdown } from './SearchableDropdown';
import { X, Loader2, Plus } from 'lucide-react';
import { mapFieldDataToForm as mapDistrictFieldDataToForm } from '../types/dtos/district/DistrictViewDTO';
import { mapFieldDataToForm as mapLocationFieldDataToForm } from '../types/dtos/location/LocationViewDTO';
import { mapFieldDataToForm as mapStreetFieldDataToForm } from '../types/dtos/street/StreetViewDTO';
import { LocationsManager } from '../apiClients/locations';

interface DynamicFormProps {
  config: ObjectConfig;
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
  isNested?: boolean;
  parentData?: Record<string, any>;
}

export function DynamicForm({
  config,
  initialData,
  onSubmit,
  onCancel,
  isNested = false,
  parentData
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [nestedForms, setNestedForms] = useState<Record<string, boolean>>({});
  const [relationshipData, setRelationshipData] = useState<Record<string, any[]>>({});
  const [filteredOptions, setFilteredOptions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // Initialize form with default values
    const defaultData: Record<string, any> = {};
    Object.entries(config.fields).forEach(([key, field]) => {
      if (field.defaultValue !== undefined && formData[key] === undefined) {
        defaultData[key] = field.defaultValue;
      }
    });
    setFormData(prev => ({ ...prev, ...defaultData }));

    // Load relationship data
    Object.entries(config.fields).forEach(([key, field]) => {
      if (field.type === 'object' || field.type === 'array') {
        switch (field.objectConfig?.type) {
          case 'district': {
            DistrictManager.getInstance().getAll().then((data) => {
              setRelationshipData(prev => ({
                ...prev,
                [key]: data.map(mapDistrictFieldDataToForm)
              }));
              console.log('retrieved districts: ', relationshipData[key]);
            }).catch((err) => { console.error(err); });
          }; break;
          case 'location': { 
            LocationsManager.getInstance().getAll().then((data) => {
              setRelationshipData(prev => ({
                ...prev,
                [key]: data.map(mapLocationFieldDataToForm).map((o: any) => ({ id: o.id, name: 'Location' }))
              }));
            }).catch((err) => { console.error(err); });
          }; break;
          case 'street': {
            StreetManager.getInstance().getAll().then((data) => {
              setRelationshipData(prev => ({
                ...prev,
                [key]: data.map(mapStreetFieldDataToForm).map((o: any) => ({ id: o.id, name: o.name }))
              }));
            }).catch((err) => { console.error(err); });
          }
          break;
        }
      }
    });
  }, [config.fields]);

  const validateField = (name: string, value: any): string => {
    const field = config.fields[name];
    if (!field) return '';

    if (field.required && !value) {
      return 'This field is required';
    }

    if (field.validation) {
      return field.validation(value) || '';
    }

    return '';
  };

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));

    // Handle relationships based on dependsOn property
    Object.entries(config.fields).forEach(([key, field]) => {
      if (field.dependsOn?.some(dep => dep.object === name) && value) {
        const relatedData = relationshipData[key]?.filter((item: any) => {
          return field.dependsOn?.every(dep => {
            const parentField = config.fields[dep.object];
            if (parentField.type === 'array' || parentField.type === 'object') {
              return Array.isArray(value[dep.fieldName]) && value[dep.fieldName].some((parentItem: any) => parentItem.id == item.id);
            }
            return value[dep.fieldName] === item.id;
          });
        });
        setFilteredOptions(prev => ({ ...prev, [key]: relatedData }));
      }
    });
  };

  const handleNestedSubmit = (fieldName: string, data: Record<string, any>) => {
    console.log('Nested form submitted:', fieldName, data);
    relationshipData[fieldName].push(data);

    data.id = -1;
    handleChange(fieldName, data);
    setNestedForms(prev => ({ ...prev, [fieldName]: false }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    Object.entries(config.fields).forEach(([name, field]) => {
      const error = validateField(name, formData[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  /**
   * Handles the form submission event.
   * 
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>} A promise that resolves when the form submission is complete.
   * 
   * The function performs the following steps:
   * 1. Logs the form data to the console.
   * 2. Prevents the default form submission behavior.
   * 3. Validates the form data. If the validation fails, the function returns early.
   * 4. Sets the loading state to true.
   * 5. Attempts to submit the form data using the `onSubmit` function.
   * 6. Sets the loading state to false after the submission attempt, regardless of success or failure.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    console.log('Form submitted:', formData);
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (name: string, field: FormField) => {
    const showField = !field.dependsOn || field.dependsOn.every(dep => formData[dep.object]) || !field.hidden;

    if (!showField) return null;

    return (
      <div key={name} className="space-y-1">
        {field.type === 'object' && (
          <SearchableDropdown
            label={field.label}
            instances={filteredOptions[name] || relationshipData[name] || []}
            selectedId={formData[name]?.id}
            onSelect={(id) => {
              if (id) {
                const instance = relationshipData[name]?.find(i => i.id === id);
                handleChange(name, instance);
              } else {
                handleChange(name, null);
              }
            }}
            onCreateNew={() => setNestedForms(prev => ({ ...prev, [name]: true }))}
            loading={!relationshipData[name]}
            error={errors[name]}
            required={field.required}
          />
        )}

        {field.type === 'array' && (
          <MultiSelectDropdown
            label={field.label}
            instances={relationshipData[name] || []}
            selectedIds={(formData[name] || []).map((item: any) => item.id)}
            onSelect={(ids) => {
              const selectedInstances = relationshipData[name]?.filter(
                instance => ids.includes(instance.id)
              );
              handleChange(name, selectedInstances);
            }}
            onCreateNew={() => setNestedForms(prev => ({ ...prev, [name]: true }))}
            error={errors[name]}
            required={field.required}
          />
        )}

        {field.type === 'text' && (
          <div>
            <label
              htmlFor={name}
              className="block text-sm font-medium text-gray-700"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              id={name}
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              className={`
                mt-1 block w-full rounded-md shadow-sm
                ${errors[name]
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
              `}
              placeholder={field.placeholder}
            />
            {errors[name] && (
              <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
            )}
          </div>
        )}

        {field.type === 'number' && (
          <div>
            <label
              htmlFor={name}
              className="block text-sm font-medium text-gray-700"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              id={name}
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, parseFloat(e.target.value))}
              className={`
                mt-1 block w-full rounded-md shadow-sm
                ${errors[name]
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
              `}
              step={field.step}
              min={field.min}
              max={field.max}
            />
            {errors[name] && (
              <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
            )}
          </div>
        )}

        {field.type === 'select' && (
          <div>
            <label
              htmlFor={name}
              className="block text-sm font-medium text-gray-700"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              id={name}
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              className={`
                mt-1 block w-full rounded-md shadow-sm
                ${errors[name]
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
              `}
            >
              <option value="">Select {field.label}</option>
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors[name] && (
              <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isNested ? `Add ${config.label}` : `Create New ${config.label}`}
            </h2>
            {isNested && (
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-6 space-y-6">
          {Object.entries(config.fields).map(([name, field]) => renderField(name, field))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {isNested ? 'Add' : 'Create'}
          </button>
        </div>
      </form>

      {Object.entries(nestedForms).map(([name, isVisible]) => (
        isVisible && config.fields[name].objectConfig && (
          <div key={name} className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <DynamicForm
                config={objectConfigs[config.fields[name].objectConfig.type]}
                initialData={formData[name]}
                onSubmit={(data) => handleNestedSubmit(name, data)}
                onCancel={() => setNestedForms(prev => ({ ...prev, [name]: false }))}
                isNested={true}
                parentData={formData}
              />
            </div>
          </div>
        )
      ))}
    </>
  );
}

