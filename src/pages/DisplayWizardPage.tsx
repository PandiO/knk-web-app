// DisplayWizardPage - Page component for displaying entities
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import DisplayWizard from '../components/DisplayWizard/DisplayWizard';
import { EntityDetailHeader } from '../components/DisplayWizard/EntityDetailHeader';
import { DisplayAction } from '../types/dtos/displayConfig/DisplayModels';
import { usePageTitle } from '../hooks/usePageTitle';
import { useEntityMetadata } from '../hooks/useEntityMetadata';
import { useConfirm } from '../hooks/useConfirm';
import { buildReturnTo, dashboardPath, displayPath, editOpensFormWizard, entityEditPath, newFormPath, readReturnTo } from '../utils/returnTo';
import { detailTrail } from '../utils/breadcrumbs';
import { entityDisplayLabel, typeLabelFor } from '../utils/entityLabel';
import { getDeleteFunctionForEntity } from '../utils/entityApiMapping';
import { apiRefusalReason } from '../utils/apiRefusalReason';
import { toast } from '../utils/toast';
import { describeActors, useLiveEntityChanges } from '../realtime/liveUpdates';
import { formatTime } from '../utils/format';
import { useAllNodesGate } from '../hooks/useActionGate';
import { withContentNode } from '../hooks/useEntityAccess';
import { FeedbackModal } from '../components/FeedbackModal';
import { refusedDeleteDetails } from '../components/ReferenceDetails';
import { isReferenceRefusal } from '../utils/referenceDetails';

/** Tells the page the entity's label once the wizard loaded it (for the tab title). */
const LabelReporter: React.FC<{ label: string; onLabel: (label: string) => void }> = ({ label, onLabel }) => {
  useEffect(() => {
    onLabel(label);
  }, [label, onLabel]);
  return null;
};

export const DisplayWizardPage: React.FC = () => {
  const { entityName, id } = useParams<{ entityName: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { baseMetadata } = useEntityMetadata();
  const [confirm, confirmModal] = useConfirm();
  const [entityLabel, setEntityLabel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // #44: a delete refused because the record is still used opens a dialog that can list what uses it.
  const [inUse, setInUse] = useState<{ title: string; message: string } | null>(null);
  // #183 (Realtime S4): another admin's change to this entity re-reads it quietly, with a short
  // "Updated by …" line; a delete says so instead (the page stays, with a way back).
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [liveNotice, setLiveNotice] = useState<{ text: string; deleted: boolean } | null>(null);
  const numericId = id != null && /^\d+$/.test(id) ? Number(id) : null;
  useEffect(() => setLiveNotice(null), [entityName, id]);

  const labelFor = useMemo(() => typeLabelFor(baseMetadata), [baseMetadata]);
  // #188 / #280: Edit and Delete of this record need the type's action nodes (Delete: area node + knk.admin.delete).
  const typeMeta = useMemo(
    () => baseMetadata?.find(meta => meta.entityName.toLowerCase() === (entityName ?? '').toLowerCase()),
    [baseMetadata, entityName]
  );
  // #371: Edit opens the form wizard, which needs knk.admin.content on top of the type's edit nodes (a user's Edit opens
  // the player profile instead).
  const editNodes = useMemo(
    () => (editOpensFormWizard(entityName) ? withContentNode(typeMeta?.actionNodes?.edit) : typeMeta?.actionNodes?.edit),
    [entityName, typeMeta]
  );
  const editGate = useAllNodesGate(editNodes);
  const deleteGate = useAllNodesGate(typeMeta?.actionNodes?.delete);
  const typeLabel = entityName ? labelFor(entityName) : '';
  useLiveEntityChanges(entityName && numericId != null ? entityName : null, change => {
    if (change.deleted) {
      setLiveNotice({ text: describeActors(change.actors, `This ${typeLabel || 'item'} was deleted`), deleted: true });
      return;
    }
    setLiveRefreshKey(previous => previous + 1);
    if (change.reconnect && change.actors.length === 0) return;
    const time = formatTime(new Date(), { hour: '2-digit', minute: '2-digit' });
    setLiveNotice(previous => previous?.deleted ? previous : { text: `${describeActors(change.actors)} at ${time}`, deleted: false });
  }, { id: numericId });
  // #81: an entity-specific tab title ("Cinix · Town"), generic until the entity loaded.
  usePageTitle(entityLabel ? `${entityLabel} · ${typeLabel}` : 'Details');

  // Back goes where the page was opened from (the dashboard type), else the dashboard on this type.
  const returnTo = readReturnTo(searchParams);
  const backTarget = returnTo ?? dashboardPath(entityName);
  // A form or another detail page opened from here comes back to this page (with its own returnTo).
  const here = buildReturnTo(location);

  const handleActionClick = (action: DisplayAction) => {
    switch (action.type) {
      case 'edit':
        if (action.entityId != null) navigate(entityEditPath(action.entityType, action.entityId, here));
        break;
      case 'view':
        if (action.entityId != null) navigate(displayPath(action.entityType, action.entityId, here));
        break;
      case 'create':
        navigate(newFormPath(action.entityType, here));
        break;
      // select / unlink / add / remove / delete are handled by the wizard itself (#188).
      default:
        break;
    }
  };

  if (!entityName || !id) {
    return (
      <div className="page-container">
        <div className="error-message">Invalid parameters</div>
      </div>
    );
  }

  const handleDelete = async (label: string) => {
    const confirmed = await confirm({
      title: `Delete ${typeLabel} "${label}"?`,
      message: `${typeLabel} "${label}" is deleted. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await getDeleteFunctionForEntity(entityName)(id);
      toast.success(`${typeLabel} "${label}" deleted.`);
      navigate(backTarget);
    } catch (error) {
      const reason = apiRefusalReason(error) ?? `${typeLabel} "${label}" could not be deleted.`;
      if (isReferenceRefusal(error)) {
        setInUse({ title: `${typeLabel} "${label}" is still in use`, message: reason });
      } else {
        toast.error(reason);
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderHeader = (entity: Record<string, unknown>) => {
    const label = entityDisplayLabel(entity, id);
    return (
      <>
        <LabelReporter label={label} onLabel={setEntityLabel} />
        <EntityDetailHeader
          title={label}
          typeLabel={typeLabel}
          trail={detailTrail({ returnTo, entityTypeName: entityName, entityLabel: label, labelFor })}
          onBack={() => navigate(backTarget)}
          onEdit={() => navigate(entityEditPath(entityName, id, here))}
          onDelete={() => handleDelete(label)}
          deleting={deleting}
          checking={editGate.checking || deleteGate.checking}
          editBlocked={editGate.allowed || editGate.checking ? null : editGate.hint}
          deleteBlocked={typeMeta?.deletable === false
            ? `${typeLabel} records can't be deleted.`
            : deleteGate.allowed || deleteGate.checking ? null : deleteGate.hint}
        />
      </>
    );
  };

  return (
    <div className="page-container">
      {liveNotice?.deleted ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
          <span>{liveNotice.text}.</span>
          <button type="button" className="btn-secondary text-sm" onClick={() => navigate(backTarget)}>Back</button>
        </div>
      ) : (
        <p role="status" aria-live="polite" data-testid="detail-live-notice"
          className={liveNotice ? 'mb-2 text-xs text-muted' : 'sr-only'}>
          {liveNotice?.text ?? ''}
        </p>
      )}
      <DisplayWizard
        entityTypeName={entityName}
        entityId={parseInt(id)}
        onActionClick={handleActionClick}
        renderHeader={renderHeader}
        liveRefreshKey={liveRefreshKey}
      />
      {confirmModal}
      <FeedbackModal
        open={inUse !== null}
        title={inUse?.title ?? ''}
        message={inUse?.message ?? ''}
        status="error"
        onClose={() => setInUse(null)}
        details={inUse ? refusedDeleteDetails(entityName, id, {
          typeLabel: labelFor,
          returnTo: here,
          onFollow: () => setInUse(null),
        }) : undefined}
      />
    </div>
  );
};

export default DisplayWizardPage;
