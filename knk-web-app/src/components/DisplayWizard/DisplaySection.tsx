// DisplaySection Component - Renders a section with fields or collection
import React from 'react';
import { DisplayField } from './DisplayField';
import { CollectionSection } from './CollectionSection';
import { ActionButtons } from './ActionButtons';
import { DisplaySectionProps, ActionButtonsConfigDto } from '../../types/displayConfiguration';

export const DisplaySection: React.FC<DisplaySectionProps> = ({
  section,
  entityData,
  onActionClick
}) => {
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
    sectionData = (entityData as Record<string, unknown>)[section.relatedEntityPropertyName];
  }

  // Parse action buttons config
  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800">{section.sectionName}</h3>
        {section.description && (
          <p className="text-sm text-gray-600 mt-1">{section.description}</p>
        )}
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
                  data={sectionData}
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
            />
          </>
        )}
      </div>
    </div>
  );
};
