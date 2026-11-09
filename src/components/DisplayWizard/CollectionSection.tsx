// CollectionSection Component - Renders collection data with template
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DisplayField } from './DisplayField';
import { ActionButtons, ButtonGate, OPEN_GATE } from './ActionButtons';
import { CollectionSectionProps, ActionButtonsConfigDto } from '../../types/dtos/displayConfig/DisplayModels';
import { RelationshipMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { Pager } from '../Pager';
import { relatedIdOf, relatedLabelOf } from './detailPage';

/** #189: items per page of a collection (a 3-column grid: four rows). */
export const COLLECTION_PAGE_SIZE = 12;

type Props = CollectionSectionProps & {
  /** #188: the section's relationship from the page type's metadata. */
  relationship?: RelationshipMetadataDto;
  linkGate?: ButtonGate;
  unlinkGate?: ButtonGate;
  deleteGate?: ButtonGate;
};

export const CollectionSection: React.FC<Props> = ({
  section,
  collectionData,
  onActionClick,
  relationship,
  linkGate = OPEN_GATE,
  unlinkGate = OPEN_GATE,
  deleteGate = OPEN_GATE,
}) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const items = Array.isArray(collectionData) ? collectionData : [];
  const lastPage = Math.max(1, Math.ceil(items.length / COLLECTION_PAGE_SIZE));
  // An unlink or a live update can shrink the list under the current page.
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  // A link row (ItemBlueprintTag) opens the other side (Tag); other items are the related type.
  const itemType = relationship?.storage === 'linkRow' ? relationship.relatedType : section.relatedEntityTypeName;

  // Item template: the collection section's own fields (the builder offers the item
  // type's properties for them, so they resolve against each item); otherwise the
  // first subsection
  const itemTemplate = section.fields?.length > 0 ? section : section.subSections?.[0];

  const handleEditEntity = (editEntityId: string | number) => {
    if (itemType) navigate(`/forms/${itemType}/edit/${editEntityId}`);
  };

  const header = (
    <ActionButtons
      config={actionButtons}
      isCollection={true}
      entityType={itemType}
      onActionClick={onActionClick}
      relationship={relationship}
      linkGate={linkGate}
    />
  );

  if (items.length === 0) {
    return (
      <div>
        <p className="py-6 text-center text-muted">No {section.sectionName.toLowerCase()} yet.</p>
        {header}
      </div>
    );
  }

  if (!itemTemplate) {
    return <p className="py-6 text-center text-danger">This list has no item layout configured.</p>;
  }

  const fieldOrder: string[] = itemTemplate.fieldOrderJson
    ? JSON.parse(itemTemplate.fieldOrderJson)
    : [];
  const orderedFields = fieldOrder.length > 0
    ? fieldOrder
        .map(guid => itemTemplate.fields.find(f => f.fieldGuid === guid))
        .filter(Boolean)
    : itemTemplate.fields;

  const pageItems = items.slice((page - 1) * COLLECTION_PAGE_SIZE, page * COLLECTION_PAGE_SIZE);
  // The item buttons share one gate: say once, visibly, why Unlink or Delete is off (each button also has it).
  const itemHints = [
    actionButtons.showRemoveButton && relationship && !unlinkGate.allowed && unlinkGate.reason ? `Unlink: ${unlinkGate.reason}` : null,
    actionButtons.showDeleteButton && !deleteGate.allowed && deleteGate.reason ? `Delete: ${deleteGate.reason}` : null,
  ].filter((hint): hint is string => !!hint);

  return (
    <div className="space-y-4">
      {header}
      {itemHints.map(hint => <p key={hint} className="text-xs text-muted">{hint}</p>)}

      <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label={section.sectionName}>
        {pageItems.map((item, index) => {
          const record = item as Record<string, unknown>;
          const relatedId = relatedIdOf(item, relationship);
          const label = relatedLabelOf(item, relationship);
          return (
            <li key={String(relatedId ?? record.id ?? index)} className="min-w-0 rounded-lg border border-line bg-surface-alt p-4">
              <dl className="space-y-3">
                {orderedFields.map((field, fieldIndex) => field && (
                  <DisplayField
                    key={field.fieldGuid ?? fieldIndex}
                    field={field}
                    data={item}
                    recordLink={fieldIndex === 0 ? { typeName: itemType, id: relatedId } : undefined}
                  />
                ))}
              </dl>

              <ActionButtons
                config={actionButtons}
                isCollection={true}
                entityType={itemType}
                entityData={record}
                onActionClick={onActionClick}
                isItemLevel={true}
                onEdit={itemType ? handleEditEntity : undefined}
                relationship={relationship}
                relatedId={relatedId}
                relatedLabel={label}
                unlinkGate={unlinkGate}
                deleteGate={deleteGate}
              />
            </li>
          );
        })}
      </ul>

      {items.length > COLLECTION_PAGE_SIZE && (
        <Pager
          page={Math.min(page, lastPage)}
          pageSize={COLLECTION_PAGE_SIZE}
          totalCount={items.length}
          onPageChange={setPage}
          label={`${section.sectionName} pages`}
          noun={section.sectionName.toLowerCase()}
          className="rounded-md border border-line"
        />
      )}
    </div>
  );
};
