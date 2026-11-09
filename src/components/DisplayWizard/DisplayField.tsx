// DisplayField Component - Renders individual field with template text support and optional hot edit
import React, { useId, useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { DisplayFieldProps } from '../../types/dtos/displayConfig/DisplayModels';
import { useTemplateParser } from './hooks/useTemplateParser';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { MinecraftIcon } from '../minecraft/MinecraftIcon';
import { EMPTY_VALUE, formatDate, formatDateTime, formatNumber, isIsoDateTimeString } from '../../utils/format';
import { DetailLinks, useDetailLinks } from './detailPage';

type Props = DisplayFieldProps & {
  parentEntityType?: string;
  /**
   * #189: where the value leads when it isn't a related record of its own (the first field of a collection item or of
   * a related section opens that record). A related-record field links to its own record instead.
   */
  recordLink?: { typeName?: string; id?: number };
};

/**
 * One value of the detail page (#189): a label and the value as text, not a disabled-looking input box. A related
 * record's value is a link to its detail page when the viewer may read that type (otherwise plain text with the
 * reason). Hot edit (a pencil on editable simple fields) saves with Enter or ✓ and cancels with Escape or ×.
 * Rendered as a `<dt>`/`<dd>` pair inside the section's `<dl>`.
 */
export const DisplayField: React.FC<Props> = ({
  field,
  data,
  onValueChange,
  parentEntityType,
  recordLink,
}) => {
  const { parseTemplate } = useTemplateParser();
  const links = useDetailLinks();
  const inputId = useId();
  const errorId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  // Why the last save didn't happen (a bad number or the API's refusal); was a browser alert.
  const [editError, setEditError] = useState<string | null>(null);

  // A field dedicated to a related entity reads that entity first.
  let sourceData: unknown = data;
  if (field.relatedEntityPropertyName && data) {
    sourceData = getNestedValue(data, field.relatedEntityPropertyName);
  }

  let displayValue: unknown;
  if (field.templateText) {
    displayValue = parseTemplate(field.templateText, (sourceData ?? {}) as Record<string, unknown>);
  } else if (field.fieldName) {
    // Direct property access (supports nested: "street.name")
    displayValue = getNestedValue(sourceData, field.fieldName);
  } else {
    displayValue = null;
  }

  // Editable: only simple fields of the entity itself, not related entities.
  const fieldTypeLower = field.fieldType?.toLowerCase() || '';
  const canEdit = field.isEditableInDisplay &&
                  !field.relatedEntityPropertyName &&
                  !!field.fieldName &&
                  !!onValueChange &&
                  ['string', 'integer', 'number', 'boolean'].includes(fieldTypeLower);

  const handleEditStart = () => {
    setEditError(null);
    setEditValue(displayValue === null || displayValue === undefined ? '' : String(displayValue));
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    if (isSaving) return;
    setEditError(null);
    setIsEditing(false);
    setEditValue('');
  };

  const handleEditSave = async () => {
    if (!onValueChange || !field.fieldName || isSaving) return;

    setIsSaving(true);
    setEditError(null);
    try {
      let newValue: unknown = editValue;
      if (fieldTypeLower === 'integer' || fieldTypeLower === 'number') {
        newValue = fieldTypeLower === 'integer' ? parseInt(editValue, 10) : parseFloat(editValue);
        if (isNaN(newValue as number)) {
          setEditError('Enter a number.');
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
      setEditError(apiRefusalReason(err) ?? 'The change could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  // #189: Enter saves, Escape cancels (and doesn't close anything around it).
  const onEditKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleEditSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handleEditCancel();
    }
  };

  const ownRecord = field.relatedEntityPropertyName && sourceData && typeof sourceData === 'object'
    ? { typeName: field.relatedEntityTypeName, id: idOf(sourceData) }
    : undefined;
  const target = ownRecord?.id != null ? ownRecord : recordLink;

  return (
    <div className="min-w-0">
      <dt className="text-sm font-medium text-muted">
        {isEditing ? <label htmlFor={inputId}>{field.label}</label> : field.label}
        {field.relatedEntityPropertyName && (
          <span className="ml-2 text-xs font-normal text-muted">
            (from {field.relatedEntityTypeName || field.relatedEntityPropertyName})
          </span>
        )}
      </dt>

      <dd className="mt-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            {fieldTypeLower === 'boolean' ? (
              <select
                id={inputId}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={onEditKeyDown}
                autoFocus
                aria-describedby={editError ? errorId : undefined}
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                id={inputId}
                type={fieldTypeLower === 'integer' || fieldTypeLower === 'number' ? 'number' : 'text'}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={onEditKeyDown}
                autoFocus
                aria-describedby={editError ? errorId : undefined}
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            <button
              type="button"
              onClick={() => void handleEditSave()}
              disabled={isSaving}
              className="rounded-md bg-success-soft p-2 text-success transition-colors hover:bg-success-muted disabled:opacity-50"
              title="Save (Enter)"
              aria-label={`Save ${field.label}`}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleEditCancel}
              disabled={isSaving}
              className="rounded-md bg-danger-soft p-2 text-danger transition-colors hover:bg-danger-muted disabled:opacity-50"
              title="Cancel (Esc)"
              aria-label={`Cancel editing ${field.label}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <div className="min-w-0 break-words text-base text-fg">
              {renderDisplayValue(sourceData, field, displayValue, parentEntityType, target, links)}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={handleEditStart}
                className="-mt-0.5 flex-shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-info-soft hover:text-primary"
                title="Edit this field"
                aria-label={`Edit ${field.label}`}
              >
                <Edit2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {isEditing && editError && (
          <p id={errorId} className="field-error text-sm mt-1" role="alert">{editError}</p>
        )}

        {field.description && (
          <p className="text-xs text-muted mt-1">{field.description}</p>
        )}
      </dd>
    </div>
  );
};

function idOf(record: unknown): number | undefined {
  const value = (record as Record<string, unknown> | null)?.id ?? (record as Record<string, unknown> | null)?.Id;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

/** The value, as a link to the record's detail page when there is one the viewer may open. */
function withLink(content: React.ReactNode, target: Props['recordLink'], links: DetailLinks | null): React.ReactNode {
  if (!links || !target?.typeName || target.id == null) return content;
  const href = links.hrefFor(target.typeName, target.id);
  if (!href) {
    const { hint } = links.access(target.typeName);
    return hint ? <span title={hint}>{content}</span> : content;
  }
  return (
    <a href={href} onClick={event => links.follow(event, href)} className="text-primary hover:underline">
      {content}
    </a>
  );
}

// Helper: Render display value with special handling for MinecraftMaterialRef icons
function renderDisplayValue(
  sourceData: unknown,
  field: DisplayFieldProps['field'],
  displayValue: unknown,
  parentEntityType: string | undefined,
  target: Props['recordLink'],
  links: DetailLinks | null
): React.ReactNode {
  const isMinecraftEntity = field.relatedEntityTypeName === 'MinecraftMaterialRef' ||
                            field.relatedEntityTypeName === 'MinecraftBlockRef' ||
                            parentEntityType === 'MinecraftMaterialRef' ||
                            parentEntityType === 'MinecraftBlockRef';

  // A direct property of a material section: the section header already shows its icon.
  const isDirectPropertyOfParent = (parentEntityType === 'MinecraftMaterialRef' || parentEntityType === 'MinecraftBlockRef') &&
                                   !field.relatedEntityPropertyName;

  if (isMinecraftEntity && typeof sourceData === 'object' && sourceData !== null && !isDirectPropertyOfParent) {
    const data = sourceData as Record<string, unknown>;
    const iconUrl = data.iconUrl || data.IconUrl;
    const namespaceKey = data.namespaceKey || data.NamespaceKey;

    // KNG-200 phase 4: MinecraftIcon shows a placeholder for a missing or broken icon.
    if (iconUrl || namespaceKey) {
      return (
        <div className="flex items-center gap-3">
          <MinecraftIcon
            src={iconUrl ? String(iconUrl) : null}
            alt={String(namespaceKey || 'Material')}
            size={32}
          />
          <div className="min-w-0">
            <div className="font-medium text-fg">
              {withLink(String(namespaceKey || displayValue || EMPTY_VALUE), target, links)}
            </div>
            {displayValue && displayValue !== namespaceKey && (
              <div className="text-xs text-muted">{String(displayValue)}</div>
            )}
          </div>
        </div>
      );
    }
  }

  const formattedValue = formatValue(displayValue, field.fieldType);
  if (formattedValue === EMPTY_VALUE) {
    return <span className="text-muted" aria-label={`${field.label}: not set`}>{EMPTY_VALUE}</span>;
  }
  return withLink(formattedValue, target, links);
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
      current = record[part] ?? record[toPascalCase(part)] ?? record[toCamelCase(part)];
    } else {
      return null;
    }
  }

  return current;
}

function toPascalCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Helper: Format value based on type. #187: through utils/format.ts, so API dates without a zone are read
// as UTC and shown in the viewer's time, and numbers look the same everywhere. A field without a type (or
// typed String) that holds an ISO date-time, e.g. CreatedAt, is shown as a date and time, not raw ISO text.
export function formatValue(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;

  switch (fieldType?.toLowerCase()) {
    case 'datetime':
      return formatDateTime(value as string);
    case 'date':
      return formatDate(value as string);
    case 'integer':
    case 'number':
    case 'decimal':
      return typeof value === 'number' || typeof value === 'string' ? formatNumber(value, undefined, String(value)) : String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (Array.isArray(value)) return value.length === 0 ? EMPTY_VALUE : `${formatNumber(value.length)} items`;
      if (typeof value === 'object') return EMPTY_VALUE;
      return isIsoDateTimeString(value) ? formatDateTime(value) : String(value);
  }
}
