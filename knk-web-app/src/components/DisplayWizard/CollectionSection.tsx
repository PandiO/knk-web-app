// CollectionSection Component - Renders collection data with template
import React from 'react';
import { DisplayField } from './DisplayField';
import { ActionButtons } from './ActionButtons';
import { CollectionSectionProps, ActionButtonsConfigDto } from '../../utils/domain/dto/displayConfig/DisplayModels';

export const CollectionSection: React.FC<CollectionSectionProps> = ({
  section,
  collectionData,
  onActionClick
}) => {
  if (!Array.isArray(collectionData) || collectionData.length === 0) {
    return <div className="text-center py-8 text-gray-500 italic">No items</div>;
  }

  // Get subsection template (first subsection)
  const itemTemplate = section.subSections?.[0];
  if (!itemTemplate) {
    return <div className="text-center py-8 text-red-500 italic">No template configured</div>;
  }

  // Parse action buttons
  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  // Parse field order for template
  const fieldOrder: string[] = itemTemplate.fieldOrderJson 
    ? JSON.parse(itemTemplate.fieldOrderJson) 
    : [];
  
  const orderedFields = fieldOrder.length > 0
    ? fieldOrder
        .map(guid => itemTemplate.fields.find(f => f.fieldGuid === guid))
        .filter(Boolean)
    : itemTemplate.fields;

  return (
    <div className="space-y-4">
      {/* Collection-level action buttons */}
      <ActionButtons
        config={actionButtons}
        isCollection={true}
        entityType={section.relatedEntityTypeName}
        onActionClick={onActionClick}
      />

      {/* Iterate over collection items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {collectionData.map((item, index) => (
          <div key={(item as Record<string, unknown>).id as string || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
            <div className="space-y-2">
              {orderedFields.map(field => field && (
                <DisplayField
                  key={field.fieldGuid}
                  field={field}
                  data={item}
                />
              ))}
            </div>

            {/* Per-item action buttons */}
            <ActionButtons
              config={actionButtons}
              isCollection={true}
              entityType={section.relatedEntityTypeName}
              entityData={item as Record<string, unknown>}
              onActionClick={onActionClick}
              isItemLevel={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
