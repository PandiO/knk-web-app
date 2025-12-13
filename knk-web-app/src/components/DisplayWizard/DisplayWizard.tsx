// DisplayWizard Component - Main container for displaying entity data
import React from 'react';
import { useDisplayConfig } from './hooks/useDisplayConfig';
import { useEntityData } from './hooks/useEntityData';
import { DisplaySection } from './DisplaySection';
import { DisplayWizardProps } from '../../utils/domain/dto/displayConfig/DisplayModels';
import './DisplayWizard.css';

export const DisplayWizard: React.FC<DisplayWizardProps> = ({
  entityTypeName,
  entityId,
  configurationId,
  onActionClick
}) => {
  const { config, loading: configLoading, error: configError } = useDisplayConfig(
    entityTypeName,
    configurationId
  );
  
  const { data: entityData, loading: dataLoading, error: dataError } = useEntityData(
    entityTypeName,
    entityId
  );

  if (configLoading || dataLoading) {
    return <div className="display-wizard-loading">Loading...</div>;
  }

  if (configError || dataError) {
    return (
      <div className="display-wizard-error">
        Error: {configError?.message || dataError?.message}
      </div>
    );
  }

  if (!config || !entityData) {
    return <div className="display-wizard-empty">No data available</div>;
  }

  // Parse sectionOrderJson to get ordered sections
  const sectionOrder: string[] = config.sectionOrderJson 
    ? JSON.parse(config.sectionOrderJson) 
    : [];
  
  const orderedSections = sectionOrder.length > 0
    ? sectionOrder
        .map(guid => config.sections.find(s => s.sectionGuid === guid))
        .filter(Boolean)
    : config.sections;

  return (
    <div className="display-wizard">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-3xl font-bold text-gray-900">{config.name}</h2>
        {config.description && (
          <p className="text-gray-600 mt-2">{config.description}</p>
        )}
      </div>

      <div className="space-y-6">
        {orderedSections.map(section => section && (
          <DisplaySection
            key={section.sectionGuid}
            section={section}
            entityData={entityData}
            onActionClick={onActionClick}
          />
        ))}
      </div>
    </div>
  );
};

export default DisplayWizard;
