// DisplayWizardPage - Page component for displaying entities
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DisplayWizard from '../components/DisplayWizard/DisplayWizard';
import { DisplayAction } from '../types/displayConfiguration';

export const DisplayWizardPage: React.FC = () => {
  const { entityName, id } = useParams<{ entityName: string; id: string }>();
  const navigate = useNavigate();

  const handleActionClick = (action: DisplayAction) => {
    switch (action.type) {
      case 'edit':
        navigate(`/form/${action.entityType}/${action.entityId}`);
        break;
      case 'view':
        navigate(`/display/${action.entityType}/${action.entityId}`);
        break;
      case 'create':
        navigate(`/form/${action.entityType}/new`);
        break;
      case 'select':
        // TODO: Implement select modal
        console.log('Select action:', action);
        break;
      case 'unlink':
        // TODO: Implement unlink confirmation
        console.log('Unlink action:', action);
        break;
      case 'add':
        // TODO: Implement add modal
        console.log('Add action:', action);
        break;
      case 'remove':
        // TODO: Implement remove confirmation
        console.log('Remove action:', action);
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
