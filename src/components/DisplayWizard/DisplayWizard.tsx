// DisplayWizard Component - Main container for displaying entity data
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDisplayConfig } from './hooks/useDisplayConfig';
import { useEntityData } from './hooks/useEntityData';
import { DisplaySection } from './DisplaySection';
import { DisplayAction, DisplayWizardProps, DisplaySectionDto } from '../../types/dtos/displayConfig/DisplayModels';
import { RelationshipMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { getDeleteFunctionForEntity, getUpdateFunctionForEntity } from '../../utils/entityApiMapping';
import { FeedbackModal } from '../FeedbackModal';
import './DisplayWizard.css';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { usePermissions } from '../../hooks/useStaffAccess';
import { useConfirm } from '../../hooks/useConfirm';
import { toast } from '../../utils/toast';
import { relationshipClient } from '../../apiClients/relationshipClient';
import { lookupClient, LookupItemDto } from '../../apiClients/lookupClient';
import { buildReturnTo, displayPath } from '../../utils/returnTo';
import { entityDisplayLabel, entityTypeFallbackLabel } from '../../utils/entityLabel';
import { RelationshipPickerDialog } from './RelationshipPickerDialog';
import { refusedDeleteDetails } from '../ReferenceDetails';
import { isReferenceRefusal } from '../../utils/referenceDetails';
import {
  DetailLinks, DetailLinksContext, describeLoadProblem, findRelationship, metadataFor, relatedIdOf,
} from './detailPage';

interface PickerState {
  section: DisplaySectionDto;
  relationship: RelationshipMetadataDto;
  mode: 'select' | 'add';
}

/** The page sections of a configuration in their saved order. */
function orderSections(config: { sections: DisplaySectionDto[]; sectionOrderJson?: string }): DisplaySectionDto[] {
  let order: string[] = [];
  try {
    order = config.sectionOrderJson ? JSON.parse(config.sectionOrderJson) : [];
  } catch {
    order = [];
  }
  return order.length > 0
    ? order.map(guid => config.sections.find(s => s.sectionGuid === guid)).filter((s): s is DisplaySectionDto => !!s)
    : config.sections;
}

/** Every type a page can link to: sections, fields and link rows' other sides. */
function linkedTypes(sections: DisplaySectionDto[], relationships: RelationshipMetadataDto[] = []): string[] {
  const types = new Set<string>();
  const add = (t?: string) => { if (t) types.add(t); };
  const visit = (section: DisplaySectionDto) => {
    add(section.relatedEntityTypeName);
    section.fields?.forEach(f => add(f.relatedEntityTypeName));
    section.subSections?.forEach(visit);
  };
  sections.forEach(visit);
  relationships.filter(r => r.storage === 'linkRow').forEach(r => add(r.relatedType));
  return Array.from(types);
}

const isRefusal = (error: unknown, code: string): boolean =>
  (error as { response?: { error?: unknown } } | null)?.response?.error === code;

/**
 * The entity detail page body (#81 header from the page): sections of the display configuration, readable values with
 * links to related records (#189), and Select / Unlink / Add / Delete on related sections (#188).
 */
export const DisplayWizard: React.FC<DisplayWizardProps> = ({
  entityTypeName,
  entityId,
  configurationId,
  onActionClick,
  renderHeader,
  liveRefreshKey
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { baseMetadata } = useEntityMetadata();
  const [confirm, confirmModal] = useConfirm();
  const { config, loading: configLoading, error: configError } = useDisplayConfig(entityTypeName, configurationId);
  const { data: entityData, loading: dataLoading, error: dataError, refetch: refetchEntityData } = useEntityData(entityTypeName, entityId);

  // #183: a live update re-reads the entity without the loading screen.
  const lastLiveRefreshKey = useRef(liveRefreshKey);
  useEffect(() => {
    if (lastLiveRefreshKey.current === liveRefreshKey) return;
    lastLiveRefreshKey.current = liveRefreshKey;
    void refetchEntityData(true);
  }, [liveRefreshKey, refetchEntityData]);

  const [picker, setPicker] = useState<PickerState | null>(null);
  // #44: `inUse` (the API's "still in use" refusal) adds "Show what uses it" for that record.
  const [recovery, setRecovery] = useState<{
    title: string; message: string; categoryId?: number; inUse?: { entityType: string; id: number };
  } | null>(null);
  const [refusedLabel, setRefusedLabel] = useState<string | null>(null);

  const ownMeta = metadataFor(baseMetadata, entityTypeName);
  const labelOf = useCallback((typeName?: string) => {
    if (!typeName) return '';
    return metadataFor(baseMetadata, typeName)?.displayName || entityTypeFallbackLabel(typeName);
  }, [baseMetadata]);
  const typeLabel = labelOf(entityTypeName);

  // #189: which linked types the viewer may open (any one of their read nodes, #280 AM2).
  const sections = useMemo(() => (config ? orderSections(config) : []), [config]);
  const types = useMemo(() => linkedTypes(sections, ownMeta?.relationships), [sections, ownMeta]);
  const readNodes = useMemo(() => {
    const nodes = new Set<string>();
    types.forEach(t => metadataFor(baseMetadata, t)?.readNodes?.forEach(n => nodes.add(n)));
    return Array.from(nodes).sort();
  }, [types, baseMetadata]);
  const readStatuses = usePermissions(readNodes);
  const here = buildReturnTo(location);

  const links = useMemo<DetailLinks>(() => {
    const access = (typeName?: string) => {
      const nodes = metadataFor(baseMetadata, typeName)?.readNodes ?? [];
      if (nodes.length === 0) return { readable: true, hint: null };
      if (nodes.some(n => readStatuses[n] === 'allowed')) return { readable: true, hint: null };
      if (nodes.some(n => (readStatuses[n] ?? 'checking') === 'checking')) return { readable: false, hint: null };
      return { readable: false, hint: `Opening ${labelOf(typeName)} requires one of: ${nodes.join(', ')}` };
    };
    return {
      access,
      hrefFor: (typeName, id) => (typeName && id != null && access(typeName).readable ? displayPath(typeName, id, here) : null),
      follow: (event, href) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(href);
      },
    };
  }, [baseMetadata, readStatuses, labelOf, here, navigate]);

  // A refused read: name the record anyway when the lookup may (any area node, #280 AM2).
  const problem = configError || dataError
    ? describeLoadProblem(dataError ?? configError, dataError ? 'entity' : 'configuration', typeLabel, entityId)
    : null;
  const lookupGettable = ownMeta?.lookupGettable === true;
  useEffect(() => {
    setRefusedLabel(null);
    if (problem?.kind !== 'noAccess' || !lookupGettable) return;
    let cancelled = false;
    lookupClient.get(entityTypeName, entityId)
      .then(item => { if (!cancelled && item?.label) setRefusedLabel(item.label); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [problem?.kind, lookupGettable, entityTypeName, entityId]);

  const refreshQuietly = useCallback(() => refetchEntityData(true), [refetchEntityData]);

  if (configLoading || dataLoading) {
    return <div className="display-wizard-loading" role="status">Loading…</div>;
  }

  if (problem) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6" role="alert" data-testid="detail-problem">
        <h2 className="text-xl font-semibold text-fg">
          {problem.kind === 'noAccess' && refusedLabel ? `You don't have access to ${typeLabel} "${refusedLabel}".` : problem.title}
        </h2>
        {problem.detail && <p className="mt-2 text-muted">{problem.detail}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {problem.retry && (
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Try again</button>
          )}
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
    );
  }

  if (!config || !entityData) {
    return <div className="display-wizard-empty">Nothing to show.</div>;
  }

  // Hot edit: the whole entity with the one field changed, through the type's own update.
  const handleValueChange = async (fieldName: string, newValue: unknown) => {
    const updateEntity = getUpdateFunctionForEntity(entityTypeName);
    await updateEntity({ ...(entityData as Record<string, unknown>), [fieldName]: newValue, id: entityId });
    await refetchEntityData();
  };

  const ownerLabel = entityDisplayLabel(entityData, entityId);

  const unlink = async (action: DisplayAction) => {
    const relationship = findRelationship(ownMeta, action.property);
    if (!relationship) return;
    const name = action.label || `${labelOf(action.entityType)} #${action.entityId}`;
    const ok = await confirm({
      title: `Unlink "${name}"?`,
      message: `"${name}" stays as it is; only its link to ${typeLabel} "${ownerLabel}" is removed.`,
      confirmLabel: 'Unlink',
    });
    if (!ok) return;
    try {
      await relationshipClient.unlink(entityTypeName, entityId, relationship.property,
        relationship.kind === 'collection' ? action.entityId : undefined);
      toast.success(`"${name}" unlinked.`);
      await refreshQuietly();
    } catch (err) {
      toast.error(apiRefusalReason(err) ?? `"${name}" couldn't be unlinked. Try again.`);
    }
  };

  const remove = async (action: DisplayAction) => {
    if (action.entityId == null) return;
    const kind = labelOf(action.entityType);
    const name = action.label || `#${action.entityId}`;
    const ok = await confirm({
      title: `Delete ${kind} "${name}"?`,
      message: `${kind} "${name}" itself is deleted, everywhere, not only unlinked from "${ownerLabel}". This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await getDeleteFunctionForEntity(action.entityType)(action.entityId);
      toast.success(`${kind} "${name}" deleted.`);
      await refreshQuietly();
    } catch (err) {
      const reason = apiRefusalReason(err) ?? `${kind} "${name}" couldn't be deleted.`;
      const inUse = isReferenceRefusal(err) ? { entityType: action.entityType, id: action.entityId } : undefined;
      // Keep the category recovery: a category with children offers its children or a new parent.
      if (action.entityType.toLowerCase() === 'category') {
        setRecovery({ title: `${kind} "${name}" wasn't deleted`, message: reason, categoryId: action.entityId, inUse });
      } else if (inUse) {
        setRecovery({ title: `${kind} "${name}" wasn't deleted`, message: reason, inUse });
      } else {
        toast.error(reason);
      }
    }
  };

  const handleDisplayAction = (action: DisplayAction) => {
    switch (action.type) {
      case 'select':
      case 'add': {
        const section = sections.find(s => findRelationship(ownMeta, s.relatedEntityPropertyName)?.property === action.property);
        const relationship = findRelationship(ownMeta, action.property);
        if (section && relationship) setPicker({ section, relationship, mode: action.type });
        return;
      }
      case 'unlink':
      case 'remove':
        void unlink(action);
        return;
      case 'delete':
        void remove(action);
        return;
      default:
        onActionClick?.(action);
    }
  };

  const linkedIds = (() => {
    if (!picker) return new Set<number>();
    const record = entityData as Record<string, unknown>;
    const property = picker.section.relatedEntityPropertyName ?? picker.relationship.property;
    const value = record[property] ?? record[property.charAt(0).toLowerCase() + property.slice(1)]
      ?? record[property.charAt(0).toUpperCase() + property.slice(1)];
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return new Set(items.map(item => relatedIdOf(item, picker.relationship)).filter((id): id is number => id != null));
  })();

  const pick = async (item: LookupItemDto) => {
    if (!picker) return;
    const { relationship } = picker;
    const done = picker.mode === 'add' ? `"${item.label}" added.` : `${picker.section.sectionName}: "${item.label}".`;
    try {
      await relationshipClient.link(entityTypeName, entityId, relationship.property, item.id);
    } catch (err) {
      if (!isRefusal(err, 'AlreadyLinked')) {
        toast.error(apiRefusalReason(err) ?? `"${item.label}" couldn't be linked. Try again.`);
        throw err;
      }
      const move = await confirm({
        title: `Move "${item.label}" here?`,
        message: `${apiRefusalReason(err) ?? `"${item.label}" belongs to another ${typeLabel}.`} It is taken away from there.`,
        confirmLabel: 'Move here',
      });
      if (!move) throw err;
      try {
        await relationshipClient.link(entityTypeName, entityId, relationship.property, item.id, true);
      } catch (moveError) {
        toast.error(apiRefusalReason(moveError) ?? `"${item.label}" couldn't be moved. Try again.`);
        throw moveError;
      }
    }
    toast.success(done);
    setPicker(null);
    await refreshQuietly();
  };

  const pickerType = picker?.relationship.relatedType ?? '';
  const pickerTypeLabel = labelOf(pickerType);

  return (
    <DetailLinksContext.Provider value={links}>
      <div className="display-wizard">
        {renderHeader ? (
          <div className="mb-6 pb-4 border-b border-line">
            {renderHeader(entityData)}
            {config.description && (
              <p className="text-muted mt-2">{config.description}</p>
            )}
          </div>
        ) : (
          <div className="mb-6 pb-4 border-b border-line">
            <h2 className="text-3xl font-bold text-fg">{config.name}</h2>
            {config.description && (
              <p className="text-muted mt-2">{config.description}</p>
            )}
          </div>
        )}

        <FeedbackModal
          open={recovery !== null}
          title={recovery?.title ?? ''}
          message={recovery?.message ?? ''}
          status="error"
          continueLabel={recovery?.categoryId != null ? 'View children' : 'Close'}
          onContinue={recovery?.categoryId != null ? () => {
            const id = recovery.categoryId!;
            setRecovery(null);
            navigate(displayPath('category', id, here));
          } : undefined}
          secondaryLabel={recovery?.categoryId != null ? 'Reassign parent' : undefined}
          onSecondary={recovery?.categoryId != null ? () => {
            const id = recovery.categoryId!;
            setRecovery(null);
            navigate(`/forms/category/edit/${id}`);
          } : undefined}
          details={recovery?.inUse ? refusedDeleteDetails(recovery.inUse.entityType, recovery.inUse.id, {
            typeLabel: labelOf,
            returnTo: here,
            onFollow: () => setRecovery(null),
          }) : undefined}
          onClose={() => setRecovery(null)}
        />

        <div className="space-y-6">
          {sections.map(section => (
            <DisplaySection
              key={section.sectionGuid ?? section.sectionName}
              section={section}
              entityData={entityData}
              entityId={entityId}
              entityTypeName={entityTypeName}
              onActionClick={handleDisplayAction}
              onValueChange={handleValueChange}
              metadata={baseMetadata}
            />
          ))}
        </div>

        <RelationshipPickerDialog
          open={picker !== null}
          onClose={() => setPicker(null)}
          title={picker?.mode === 'add'
            ? `Add a ${pickerTypeLabel} to "${ownerLabel}"`
            : `Select the ${picker?.section.sectionName ?? pickerTypeLabel} of "${ownerLabel}"`}
          relatedType={pickerType}
          relatedLabel={pickerTypeLabel}
          searchable={metadataFor(baseMetadata, pickerType)?.lookupSearchable !== false}
          linkedIds={linkedIds}
          actionLabel={picker?.mode === 'add' ? 'Add' : 'Select'}
          onPick={pick}
        />
        {confirmModal}
      </div>
    </DetailLinksContext.Provider>
  );
};

export default DisplayWizard;
