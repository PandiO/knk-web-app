// DisplayWizardPage - Page component for displaying entities
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DisplayWizard from '../components/DisplayWizard/DisplayWizard';
import { DisplayAction } from '../types/displayConfiguration';
import { usePageTitle } from '../hooks/usePageTitle';

export const DisplayWizardPage: React.FC = () => {
  usePageTitle('Details');
  const { entityName, id } = useParams<{ entityName: string; id: string }>();
  const navigate = useNavigate();

  const handleActionClick = (action: DisplayAction) => {
    switch (action.type) {
      case 'edit':
        navigate(`/forms/${action.entityType}/edit/${action.entityId}`);
        break;
      case 'view':
        navigate(`/display/${action.entityType}/${action.entityId}`);
        break;
      case 'create':
        navigate(`/forms/${action.entityType}?autoOpen=true`);
        break;
      // select / unlink / add / remove are not built yet; ActionButtons doesn't offer them (KNG-148).
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

  return (
    <div className="page-container">
      <DisplayWizard
        entityTypeName={entityName}
        entityId={parseInt(id)}
        onActionClick={handleActionClick}
      />
    </div>
  );
};

export default DisplayWizardPage;
