// DisplayField Component - Renders individual field with template text support and optional hot edit
import React, { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { DisplayFieldProps } from '../../types/dtos/displayConfig/DisplayModels';
import { useTemplateParser } from './hooks/useTemplateParser';

export const DisplayField: React.FC<DisplayFieldProps & { parentEntityType?: string }> = ({ 
  field, 
  data,
  entityId,
  entityTypeName,
  onValueChange,
  parentEntityType
}) => {
  const { parseTemplate } = useTemplateParser();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Determine the data source
  let sourceData: unknown = data;
  
  // If field is dedicated to a related entity, navigate to that entity first
  if (field.relatedEntityPropertyName && data) {
    sourceData = getNestedValue(data, field.relatedEntityPropertyName);
    console.log('DisplayField: navigated to related entity', {
      relatedEntityPropertyName: field.relatedEntityPropertyName,
      sourceData
    });
  }

  // Determine value to display
  let displayValue: unknown;

  if (field.templateText) {
    // Use template text with variable interpolation
    displayValue = parseTemplate(field.templateText, sourceData as Record<string, unknown>);
  } else if (field.fieldName) {
    // Direct property access (supports nested: "street.name")
    displayValue = getNestedValue(sourceData, field.fieldName);
  } else {
    displayValue = null;
  }

  console.log('DisplayField: rendering', {
    field,
    data,
    sourceData,
    displayValue,
    isEditable: field.isEditableInDisplay
  });

  // Format value based on fieldType
  const formattedValue = formatValue(displayValue, field.fieldType);

  // Check if this field is editable (only for simple fields, not related entities)
  const canEdit = field.isEditableInDisplay && 
                  !field.relatedEntityPropertyName && 
                  field.fieldName &&
                  ['string', 'integer', 'number', 'boolean'].includes(field.fieldType?.toLowerCase() || '');

  const handleEditStart = () => {
    setEditValue(String(displayValue || ''));
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleEditSave = async () => {
    if (!onValueChange || !field.fieldName) return;

    setIsSaving(true);
    try {
      // Convert value based on field type
      let newValue: unknown = editValue;
      const fieldTypeLower = field.fieldType?.toLowerCase();

      if (fieldTypeLower === 'integer' || fieldTypeLower === 'number') {
        newValue = fieldTypeLower === 'integer' ? parseInt(editValue, 10) : parseFloat(editValue);
        if (isNaN(newValue as number)) {
          alert('Invalid number');
          setIsSaving(false);
          return;
        }
      } else if (fieldTypeLower === 'boolean') {
        newValue = editValue.toLowerCase() === 'true' || editValue === '1' || editValue.toLowerCase() === 'yes';
      }

      await onValueChange(field.fieldName, newValue);
      setIsEditing(false);
      setEditValue('');
    } catch (err) {
      console.error('Error saving field value:', err);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.relatedEntityPropertyName && (
          <span className="ml-2 text-xs font-normal text-blue-600">
            (from {field.relatedEntityTypeName || field.relatedEntityPropertyName})
          </span>
        )}
      </label>
      
      {isEditing ? (
        <div className="flex gap-2 items-center">
          {field.fieldType?.toLowerCase() === 'boolean' ? (
            <select
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input
              type={field.fieldType?.toLowerCase() === 'integer' || field.fieldType?.toLowerCase() === 'number' ? 'number' : 'text'}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
          <button
            onClick={handleEditSave}
            disabled={isSaving}
            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-md transition-colors disabled:opacity-50"
            title="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleEditCancel}
            disabled={isSaving}
            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          {renderDisplayValue(sourceData, field, displayValue, parentEntityType)}
          {canEdit && (
            <button
              onClick={handleEditStart}
              className="ml-2 p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
              title="Edit this field"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {field.description && (
        <p className="text-xs text-gray-500 mt-1">{field.description}</p>
      )}
    </div>
  );
};

// Helper: Render display value with special handling for MinecraftMaterialRef icons
function renderDisplayValue(sourceData: unknown, field: DisplayFieldProps['field'], displayValue: unknown, parentEntityType?: string): React.ReactElement {
  // Check if this is a MinecraftMaterialRef/BlockRef with an iconUrl
  const isMinecraftEntity = field.relatedEntityTypeName === 'MinecraftMaterialRef' || 
                            field.relatedEntityTypeName === 'MinecraftBlockRef' ||
                            parentEntityType === 'MinecraftMaterialRef' ||
                            parentEntityType === 'MinecraftBlockRef';
  
  // Skip icon rendering if:
  // 1. Parent is a Minecraft entity AND
  // 2. This field is displaying a direct property of that same parent entity (not a related entity)
  // (The parent section header already displays the icon for the entity)
  const isDirectPropertyOfParent = (parentEntityType === 'MinecraftMaterialRef' || parentEntityType === 'MinecraftBlockRef') &&
                                   !field.relatedEntityPropertyName;
  
  if (isMinecraftEntity && typeof sourceData === 'object' && sourceData !== null && !isDirectPropertyOfParent) {
    const data = sourceData as Record<string, unknown>;
    const iconUrl = data.iconUrl || data.IconUrl;
    const namespaceKey = data.namespaceKey || data.NamespaceKey;
    
    if (iconUrl) {
      return (
        <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded flex-1">
          <img 
            src={String(iconUrl)} 
            alt={String(namespaceKey || 'Material')}
            className="h-8 w-8 object-contain"
            onError={(e) => {
              // Fallback if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <div className="text-base text-gray-900 font-medium">
              {namespaceKey || displayValue || '-'}
            </div>
            {displayValue && displayValue !== namespaceKey && (
              <div className="text-xs text-gray-600">{displayValue}</div>
            )}
          </div>
        </div>
      );
    }
  }

  // Default rendering for other field types
  const formattedValue = formatValue(displayValue, field.fieldType);
  return (
    <div className="text-base text-gray-900 bg-gray-50 px-3 py-2 rounded flex-1">
      {formattedValue}
    </div>
  );
}

// Helper: Get nested property value (e.g., "street.name")
// Handles both camelCase and PascalCase property names
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return null;
  
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return null;
    if (typeof current === 'object' && current !== null) {
      const record = current as Record<string, unknown>;
      // Try original casing first, then try alternative casing
      current = record[part] ?? record[toPascalCase(part)] ?? record[toCamelCase(part)];
    } else {
      return null;
    }
  }

  return current;
}

// Helper: Convert to PascalCase (first letter uppercase)
function toPascalCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: Convert to camelCase (first letter lowercase)
function toCamelCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Helper: Format value based on type
function formatValue(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined) return '-';

  switch (fieldType?.toLowerCase()) {
    case 'datetime':
      return new Date(value as string).toLocaleString();
    case 'date':
      return new Date(value as string).toLocaleDateString();
    case 'integer':
    case 'number':
      return (value as number).toLocaleString();
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

