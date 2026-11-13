// DisplaySection Component - Renders a section with fields or collection
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DisplayField } from './DisplayField';
import { CollectionSection } from './CollectionSection';
import { ActionButtons, ButtonGate } from './ActionButtons';
import { DisplaySectionProps, ActionButtonsConfigDto } from '../../types/dtos/displayConfig/DisplayModels';
import { EntityMetadataDto, RelationshipMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { MinecraftIcon } from '../minecraft/MinecraftIcon';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { changeNodesOf, withContentNode } from '../../hooks/useEntityAccess';
import { findRelationship, metadataFor, relatedIdOf, relatedLabelOf } from './detailPage';
import { formatNumber } from '../../utils/format';
import { entityTypeFallbackLabel } from '../../utils/entityLabel';

type Props = DisplaySectionProps & {
  /** #188: every type's metadata (relationships, action nodes); without it the relationship buttons stay hidden. */
  metadata?: EntityMetadataDto[];
};

/** Select/Add and Unlink of one relationship: what the API allows (with its reason), then the nodes (#280; plus
 * knk.admin.content since #374). */
export function relationshipGate(
  allowedHere: boolean | undefined,
  reason: string | undefined,
  nodes: { allowed: boolean; checking: boolean; hint: string | null }
): ButtonGate {
  if (!allowedHere) return { allowed: false, reason: reason ?? 'Change this on the Edit page.' };
  if (nodes.checking) return { allowed: false, reason: null };
  return nodes.allowed ? { allowed: true, reason: null } : { allowed: false, reason: nodes.hint };
}

/** Delete of a related record: the type must be deletable, then `actionNodes.delete` (area node + knk.admin.delete). */
export function deleteGateOf(
  related: EntityMetadataDto | undefined,
  typeLabel: string,
  nodes: { allowed: boolean; checking: boolean; hint: string | null }
): ButtonGate {
  if (related && related.deletable === false) return { allowed: false, reason: `${typeLabel} records can't be deleted here.` };
  if (nodes.checking) return { allowed: false, reason: null };
  return nodes.allowed ? { allowed: true, reason: null } : { allowed: false, reason: nodes.hint };
}

export const DisplaySection: React.FC<Props> = ({
  section,
  entityData,
  entityId,
  entityTypeName,
  onActionClick,
  onValueChange,
  metadata,
}) => {
  const navigate = useNavigate();

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
    const propName = section.relatedEntityPropertyName;
    sectionData = record[propName] ??
                  record[toPascalCase(propName)] ??
                  record[toCamelCase(propName)];
  }

  // #188: the relationship this section shows, and who may change it.
  const ownMeta = metadataFor(metadata, entityTypeName);
  const relationship: RelationshipMetadataDto | undefined = section.relatedEntityPropertyName
    ? findRelationship(ownMeta, section.relatedEntityPropertyName)
    : undefined;
  const targetType = relationship?.storage === 'linkRow' ? relationship.relatedType : section.relatedEntityTypeName;
  const targetMeta = metadataFor(metadata, targetType);
  const targetLabel = targetMeta?.displayName || (targetType ? entityTypeFallbackLabel(targetType) : '');
  // #374: Select / Unlink / Add change the record, so they need knk.admin.content too (an API with #374 lists it in
  // `nodes` already; adding it here keeps the gate right against an older API).
  const relationshipNodes = React.useMemo(() => (relationship ? withContentNode(relationship.nodes) : undefined), [relationship]);
  const nodesGate = useAllNodesGate(relationshipNodes);
  const deleteNodes = useAllNodesGate(targetMeta?.actionNodes?.delete);
  // #383: a field's hot edit saves through the type's update (PUT), which #374 gates: the type's edit nodes plus
  // knk.admin.content (a user's keeps knk.admin.user.manage).
  const hotEditNodes = React.useMemo(() => changeNodesOf(ownMeta, 'edit', entityTypeName), [ownMeta, entityTypeName]);
  const hotEditGate = useAllNodesGate(hotEditNodes);
  const linkGate = relationshipGate(relationship?.canLink, relationship?.linkReason, nodesGate);
  const unlinkGate = relationshipGate(relationship?.canUnlink, relationship?.unlinkReason, nodesGate);
  const deleteGate = deleteGateOf(targetMeta, targetLabel, deleteNodes);

  const actionButtons: ActionButtonsConfigDto = section.actionButtonsConfigJson
    ? JSON.parse(section.actionButtonsConfigJson)
    : {};

  const handleEditEntity = (editEntityId: string | number) => {
    navigate(`/forms/${section.relatedEntityTypeName}/edit/${editEntityId}`);
  };

  // Create New with parent context, so the child can be linked after creation.
  const handleCreateNewEntity = () => {
    const queryString = `?autoOpen=true&parentEntityTypeName=${entityTypeName}&parentEntityId=${entityId}&relationshipFieldName=${section.relatedEntityPropertyName || ''}`;
    navigate(`/forms/${section.relatedEntityTypeName}${queryString}`);
  };

  const count = section.isCollection && Array.isArray(sectionData) ? sectionData.length : null;
  const isRelatedSingle = !section.isCollection && !!section.relatedEntityPropertyName;
  const hasRelated = isRelatedSingle && !!sectionData && typeof sectionData === 'object';
  const singleId = hasRelated ? relatedIdOf(sectionData, relationship) : undefined;

  return (
    <section className="bg-surface rounded-lg shadow-md p-4 sm:p-6" aria-label={section.sectionName}>
      <div className="mb-4 pb-3 border-b border-line">
        <div className="flex items-center gap-4">
          {((section.relatedEntityTypeName === 'MinecraftMaterialRef' ||
            section.relatedEntityTypeName === 'MinecraftBlockRef') &&
            sectionData && typeof sectionData === 'object') ? (
            <div className="flex-shrink-0">
              {renderMinecraftIcon(sectionData as Record<string, unknown>)}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-fg">
              {section.sectionName}
              {count !== null && (
                <span className="ml-2 align-middle rounded-full bg-surface-alt px-2 py-0.5 text-sm font-medium text-muted"
                  aria-label={`${formatNumber(count)} ${count === 1 ? 'item' : 'items'}`}>
                  {formatNumber(count)}
                </span>
              )}
            </h3>
            {section.description && (
              <p className="text-sm text-muted mt-1">{section.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {section.isCollection ? (
          <CollectionSection
            section={section}
            collectionData={sectionData as unknown[]}
            onActionClick={onActionClick}
            relationship={relationship}
            linkGate={linkGate}
            unlinkGate={unlinkGate}
            deleteGate={deleteGate}
          />
        ) : (
          <>
            {isRelatedSingle && !hasRelated ? (
              <p className="text-muted">No {targetLabel || section.sectionName} linked.</p>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                {orderedFields.map((field, index) => field && (
                  <DisplayField
                    key={field.fieldGuid ?? index}
                    field={field}
                    data={field.relatedEntityPropertyName ? entityData : sectionData}
                    entityId={entityId}
                    entityTypeName={entityTypeName}
                    onValueChange={isRelatedSingle ? undefined : onValueChange}
                    editGate={hotEditGate}
                    parentEntityType={section.relatedEntityTypeName}
                    recordLink={isRelatedSingle && index === 0 ? { typeName: targetType, id: singleId } : undefined}
                  />
                ))}
              </dl>
            )}

            <ActionButtons
              config={actionButtons}
              isCollection={false}
              entityType={targetType}
              entityData={hasRelated ? sectionData as Record<string, unknown> : undefined}
              onActionClick={onActionClick}
              onEdit={section.relatedEntityTypeName ? handleEditEntity : undefined}
              onCreateNew={section.relatedEntityTypeName ? handleCreateNewEntity : undefined}
              relationship={relationship}
              relatedId={singleId}
              relatedLabel={hasRelated ? relatedLabelOf(sectionData, relationship) : undefined}
              linkGate={linkGate}
              unlinkGate={unlinkGate}
            />
          </>
        )}
      </div>
    </section>
  );
};

function toPascalCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// KNG-200 phase 4: MinecraftIcon shows a placeholder for a missing or broken icon (icons are required, D8).
function renderMinecraftIcon(data: Record<string, unknown>): React.ReactElement {
  const iconUrl = data.iconUrl || data.IconUrl;
  const name = data.displayName || data.DisplayName || data.namespaceKey || data.NamespaceKey || 'Material';

  return (
    <div className="flex items-center justify-center h-24 w-24 bg-surface-alt rounded-lg border border-line overflow-hidden p-2">
      <MinecraftIcon src={iconUrl ? String(iconUrl) : null} alt={String(name)} size={80} />
    </div>
  );
}
