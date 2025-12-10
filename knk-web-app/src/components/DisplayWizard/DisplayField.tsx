// DisplayField Component - Renders individual field with template text support
import React from 'react';
import { DisplayFieldProps } from '../../types/displayConfiguration';
import { useTemplateParser } from './hooks/useTemplateParser';

export const DisplayField: React.FC<DisplayFieldProps> = ({ field, data }) => {
  const { parseTemplate } = useTemplateParser();

  // Determine value to display
  let displayValue: unknown;

  if (field.templateText) {
    // Use template text with variable interpolation
    displayValue = parseTemplate(field.templateText, data as Record<string, unknown>);
  } else if (field.fieldName) {
    // Direct property access (supports nested: "street.name")
    displayValue = getNestedValue(data, field.fieldName);
  } else {
    displayValue = null;
  }

  // Format value based on fieldType
  const formattedValue = formatValue(displayValue, field.fieldType);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
      <div className="text-base text-gray-900 bg-gray-50 px-3 py-2 rounded">{formattedValue}</div>
      {field.description && (
        <p className="text-xs text-gray-500 mt-1">{field.description}</p>
      )}
    </div>
  );
};

// Helper: Get nested property value (e.g., "street.name")
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return null;
  
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return null;
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
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
