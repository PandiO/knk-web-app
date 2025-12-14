// DisplayWizard Component - Main container for displaying entity data
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisplayConfig } from './hooks/useDisplayConfig';
import { useEntityData } from './hooks/useEntityData';
import { DisplaySection } from './DisplaySection';
import { DisplayAction, DisplayWizardProps } from '../../types/dtos/displayConfig/DisplayModels';
import { getUpdateFunctionForEntity } from '../../utils/entityApiMapping';
import { FeedbackModal } from '../FeedbackModal';
import './DisplayWizard.css';

export const DisplayWizard: React.FC<DisplayWizardProps> = ({
  entityTypeName,
  entityId,
  configurationId,
  onActionClick
}) => {
  const navigate = useNavigate();
  const { config, loading: configLoading, error: configError } = useDisplayConfig(
    entityTypeName,
    configurationId
  );
  
  const { data: entityData, loading: dataLoading, error: dataError, refetch: refetchEntityData } = useEntityData(
    entityTypeName,
    entityId
  );

  const [isSaving, setIsSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalStatus, setModalStatus] = useState<'success' | 'error' | 'info'>('info');
  const [modalContinueLabel, setModalContinueLabel] = useState('Continue');
  const [modalOnContinue, setModalOnContinue] = useState<(() => void | Promise<void>) | undefined>(undefined);
  const [modalOnSecondary, setModalOnSecondary] = useState<(() => void) | undefined>(undefined);
  const [modalSecondaryLabel, setModalSecondaryLabel] = useState<string | undefined>(undefined);

  if (configLoading || dataLoading) {
    console.log('DisplayWizard: loading', { configLoading, dataLoading });
    return <div className="display-wizard-loading">Loading...</div>;
  }

  if (configError || dataError) {
    console.error('DisplayWizard: error', { configError, dataError });
    return (
      <div className="display-wizard-error">
        Error: {configError?.message || dataError?.message}
      </div>
    );
  }

  if (!config || !entityData) {
    console.warn('DisplayWizard: no config or entityData', { config, entityData });
    return <div className="display-wizard-empty">No data available</div>;
  }

  // Handle hot edit value changes
  const handleValueChange = async (fieldName: string, newValue: unknown) => {
    if (!entityId || !entityTypeName) {
      console.error('entityId and entityTypeName are required for hot edit');
      return;
    }

    setIsSaving(true);
    try {
      // Get the update function for the entity type (static import within src)
      const updateEntity = getUpdateFunctionForEntity(entityTypeName);

      // Construct the updated entity object
      const updatedEntity = {
        ...(entityData as Record<string, unknown>),
        [fieldName]: newValue,
        id: entityId
      };

      // Call the update function with the updated entity
      await updateEntity(updatedEntity);

      // Refetch the entity data to get the latest values
      await refetchEntityData?.();
      console.log(`Successfully updated ${fieldName} to:`, newValue);
    } catch (err) {
      console.error('Error in handleValueChange:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Parse sectionOrderJson to get ordered sections
  const sectionOrder: string[] = config.sectionOrderJson 
    ? JSON.parse(config.sectionOrderJson) 
    : [];
  
  const orderedSections = sectionOrder.length > 0
    ? sectionOrder
        .map(guid => config.sections.find(s => s.sectionGuid === guid))
        .filter(Boolean)
    : config.sections;

  console.log('DisplayWizard: rendering', { config, entityData, orderedSections });

  const handleDisplayAction = (action: DisplayAction) => {
    if (action.type !== 'remove') {
      onActionClick?.(action);
      return;
    }

    const targetType = action.entityType || entityTypeName;
    const targetId = action.entityId;

    if (!targetType || targetId === undefined || targetId === null) {
      setModalTitle('Delete Failed');
      setModalMessage('Missing entity information for removal.');
      setModalStatus('error');
      setModalContinueLabel('Close');
      setModalOnContinue(undefined);
      setModalOnSecondary(undefined);
      setModalSecondaryLabel(undefined);
      setModalOpen(true);
      return;
    }

    const displayName = `ID ${targetId}`;

    setModalTitle('Confirm Deletion');
    setModalMessage(`Are you sure you want to delete ${targetType} ${displayName}? This action cannot be undone.`);
    setModalStatus('info');
    setModalContinueLabel('Delete');
    setModalOnSecondary(undefined);
    setModalSecondaryLabel(undefined);

    setModalOnContinue(() => async () => {
      try {
        const { getDeleteFunctionForEntity } = await import('../../utils/entityApiMapping');
        const deleteFn = getDeleteFunctionForEntity(targetType);
        await deleteFn(targetId);

        setModalTitle('Deleted');
        setModalMessage(`${targetType} ${displayName} was deleted successfully.`);
        setModalStatus('success');
        setModalContinueLabel('Close');
        setModalOnContinue(undefined);
        setModalOnSecondary(undefined);
        setModalSecondaryLabel(undefined);
        await refetchEntityData?.();
      } catch (err: any) {
        const serverMessage = err?.response?.data?.message || err?.message;
        setModalTitle('Delete Failed');
        setModalMessage(serverMessage || 'An error occurred while deleting.');
        setModalStatus('error');

        const isCategory = targetType.toLowerCase() === 'category';
        if (isCategory) {
          setModalContinueLabel('View Children');
          setModalOnContinue(() => () => {
            setModalOpen(false);
            navigate(`/display/category/${targetId}`);
          });
          setModalSecondaryLabel('Reassign Parent');
          setModalOnSecondary(() => () => {
            setModalOpen(false);
            navigate(`/forms/category/edit/${targetId}`);
          });
        } else {
          setModalContinueLabel('Close');
          setModalOnContinue(undefined);
          setModalOnSecondary(undefined);
          setModalSecondaryLabel(undefined);
        }

        throw err;
      }
    });

    setModalOpen(true);
  };

  return (
    <div className="display-wizard">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-3xl font-bold text-gray-900">{config.name}</h2>
        {config.description && (
          <p className="text-gray-600 mt-2">{config.description}</p>
        )}
      </div>

      <FeedbackModal
        open={modalOpen}
        title={modalTitle}
        message={modalMessage}
        status={modalStatus}
        continueLabel={modalContinueLabel}
        onContinue={modalOnContinue}
        onSecondary={modalOnSecondary}
        secondaryLabel={modalSecondaryLabel}
        onClose={() => setModalOpen(false)}
      />

      <div className="space-y-6">
        {orderedSections.map(section => section && (
          <DisplaySection
            key={section.sectionGuid}
            section={section}
            entityData={entityData}
            entityId={entityId}
            entityTypeName={entityTypeName}
            onActionClick={handleDisplayAction}
            onValueChange={handleValueChange}
          />
        ))}
      </div>
    </div>
  );
};

export default DisplayWizard;

