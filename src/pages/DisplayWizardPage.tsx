// DisplayWizardPage - Page component for displaying entities
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import DisplayWizard from '../components/DisplayWizard/DisplayWizard';
import { EntityDetailHeader } from '../components/DisplayWizard/EntityDetailHeader';
import { DisplayAction } from '../types/displayConfiguration';
import { usePageTitle } from '../hooks/usePageTitle';
import { useEntityMetadata } from '../hooks/useEntityMetadata';
import { useConfirm } from '../hooks/useConfirm';
import { buildReturnTo, dashboardPath, displayPath, entityEditPath, newFormPath, readReturnTo } from '../utils/returnTo';
import { detailTrail } from '../utils/breadcrumbs';
import { entityDisplayLabel, typeLabelFor } from '../utils/entityLabel';
import { getDeleteFunctionForEntity } from '../utils/entityApiMapping';
import { apiRefusalReason } from '../utils/apiRefusalReason';
import { toast } from '../utils/toast';

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

  const labelFor = useMemo(() => typeLabelFor(baseMetadata), [baseMetadata]);
  const typeLabel = entityName ? labelFor(entityName) : '';
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
      // select / unlink / add / remove are not built yet; ActionButtons doesn't offer them (#188).
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
      toast.error(apiRefusalReason(error) ?? `${typeLabel} "${label}" could not be deleted.`);
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
        />
      </>
    );
  };

  return (
    <div className="page-container">
      <DisplayWizard
        entityTypeName={entityName}
        entityId={parseInt(id)}
        onActionClick={handleActionClick}
        renderHeader={renderHeader}
      />
      {confirmModal}
    </div>
  );
};

export default DisplayWizardPage;
