// DisplaySection Component - Renders a section with fields or collection
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DisplayField } from './DisplayField';
import { CollectionSection } from './CollectionSection';
import { ActionButtons } from './ActionButtons';
import { DisplaySectionProps, ActionButtonsConfigDto } from '../../types/dtos/displayConfig/DisplayModels';
import { MinecraftIcon } from '../minecraft/MinecraftIcon';

export const DisplaySection: React.FC<DisplaySectionProps> = ({
  section,
  entityData,
  entityId,
  entityTypeName,
  onActionClick,
  onValueChange
}) => {
  const navigate = useNavigate();

  // Parse fieldOrderJson
  const fieldOrder: string[] = section.fieldOrderJson 
    ? JSON.parse(section.fieldOrderJson) 
    : [];
  
  const orderedFields = fieldOrder.length > 0
    ? fieldOrder
        .map(guid => section.fields.find(f => f.fieldGuid === guid))
        .filter(Boolean)
    : section.fields;

  // Determine data source
  let sectionData: unknown = entityData;
  if (section.relatedEntityPropertyName) {
    const record = entityData as Record<string, unknown>;
    // Handle both camelCase and PascalCase property names
    const propName = section.relatedEntityPropertyName;
    sectionData = record[propName] ?? 
                  record[toPascalCase(propName)] ?? 
                  record[toCamelCase(propName)];
  }

  console.log('DisplaySection: rendering', {
    section,
    sectionData,
    entityData,
    orderedFields
  });

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

// Helper: Render Minecraft material/block icon. KNG-200 phase 4: MinecraftIcon shows a placeholder
// for a missing or broken icon (icons are required, D8), so every material/block section has one.
function renderMinecraftIcon(data: Record<string, unknown>): React.ReactElement {
  const iconUrl = data.iconUrl || data.IconUrl;
  const name = data.displayName || data.DisplayName || data.namespaceKey || data.NamespaceKey || 'Material';

  return (
    <div className="flex items-center justify-center h-24 w-24 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden p-2">
      <MinecraftIcon src={iconUrl ? String(iconUrl) : null} alt={String(name)} size={80} />
    </div>
  );
}

  // Parse action buttons config
  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  // Handle edit button: navigate to form wizard with entityId for editing
  const handleEditEntity = (editEntityId: string | number) => {
    navigate(`/forms/${section.relatedEntityTypeName}/edit/${editEntityId}`);
  };

  // Handle create new button: navigate to form wizard to create new entity
  // Pass parent context so the child entity can establish relationship after creation
  const handleCreateNewEntity = () => {
    const queryString = `?autoOpen=true&parentEntityTypeName=${entityTypeName}&parentEntityId=${entityId}&relationshipFieldName=${section.relatedEntityPropertyName || ''}`;
    navigate(`/forms/${section.relatedEntityTypeName}${queryString}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-4">
          {/* Render icon for MinecraftMaterialRef/BlockRef sections */}
          {((section.relatedEntityTypeName === 'MinecraftMaterialRef' || 
            section.relatedEntityTypeName === 'MinecraftBlockRef') && 
            sectionData && typeof sectionData === 'object') ? (
            <div className="flex-shrink-0">
              {renderMinecraftIcon(sectionData as Record<string, unknown>)}
            </div>
          ) : null}
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-800">{section.sectionName}</h3>
            {section.description && (
              <p className="text-sm text-gray-600 mt-1">{section.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {section.isCollection ? (
          // Collection: iterate over array data
          <CollectionSection
            section={section}
            collectionData={sectionData as unknown[]}
            onActionClick={onActionClick}
          />
        ) : (
          // Single entity: render fields
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orderedFields.map(field => field && (
                <DisplayField
                  key={field.fieldGuid}
                  field={field}
                  data={field.relatedEntityPropertyName ? entityData : sectionData}
                  entityId={entityId}
                  entityTypeName={entityTypeName}
                  onValueChange={onValueChange}
                  parentEntityType={section.relatedEntityTypeName}
                />
              ))}
            </div>

            {/* Action buttons for single relationship */}
            <ActionButtons
              config={actionButtons}
              isCollection={false}
              entityType={section.relatedEntityTypeName}
              entityData={sectionData as Record<string, unknown>}
              onActionClick={onActionClick}
              onEdit={section.relatedEntityTypeName ? handleEditEntity : undefined}
              onCreateNew={section.relatedEntityTypeName ? handleCreateNewEntity : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
};

