import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workflowClient } from '../apiClients/workflowClient';
import { WizardStepContainer } from '../components/Workflow/WizardStepContainer';
import { WorldBoundFieldRenderer } from '../components/Workflow/WorldBoundFieldRenderer';
import { StepDefinition, WorkflowContext } from '../types/workflow';
import { WorkflowSessionReadDto } from '../types/dtos/workflow/WorkflowDtos';

// TODO: Get this from user context/auth
const CURRENT_USER_ID = 1;

const TOWN_STEPS: StepDefinition[] = [
  {
    stepNumber: 1,
    stepKey: 'general',
    name: 'General Information',
    requiresMinecraft: false,
    fields: ['name', 'description']
  },
  {
    stepNumber: 2,
    stepKey: 'rules',
    name: 'Rules & Settings',
    requiresMinecraft: false,
    fields: ['allowEntry', 'allowExit']
  },
  {
    stepNumber: 3,
    stepKey: 'world',
    name: 'World Data',
    requiresMinecraft: true,
    fields: ['wgRegionId', 'locationId']
  }
];

export const TownCreateWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepData, setStepData] = useState<Record<number, any>>({
    1: {},
    2: {},
    3: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize workflow on mount
  useEffect(() => {
    const initWorkflow = async () => {
      setLoading(true);
      try {
        const session = await workflowClient.createSession({
          userId: CURRENT_USER_ID,
          entityTypeName: 'Town'
        });
        setWorkflowId(session.id);
      } catch (err) {
        console.error('Failed to create workflow:', err);
        setError('Failed to start town creation wizard');
      } finally {
        setLoading(false);
      }
    };

    initWorkflow();
  }, []);

  const handleStepDataChange = (field: string, value: any) => {
    setStepData((prev) => ({
      ...prev,
      [currentStep]: {
        ...prev[currentStep],
        [field]: value
      }
    }));
  };

  const handleNext = async () => {
    if (!workflowId) return;

    setLoading(true);
    setError(null);

    try {
      await workflowClient.updateStep(workflowId, currentStep, stepData[currentStep]);
      setCurrentStep((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to save step:', err);
      setError('Failed to save step data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleFinalize = async () => {
    if (!workflowId) return;

    setLoading(true);
    setError(null);

    try {
      // Save final step data
      await workflowClient.updateStep(workflowId, currentStep, stepData[currentStep]);
      
      // Finalize workflow
      const finalizedSession = await workflowClient.finalize(workflowId);
      
      alert('Town created successfully!');
      
      // Navigate to town detail page (if entityId is available)
      if (finalizedSession.entityId) {
        navigate(`/towns/${finalizedSession.entityId}`);
      } else {
        navigate('/towns');
      }
    } catch (err) {
      console.error('Failed to finalize workflow:', err);
      setError('Failed to create town. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (): boolean => {
    const data = stepData[currentStep];
    
    switch (currentStep) {
      case 1:
        return !!(data.name && data.description);
      case 2:
        return true; // Optional fields
      case 3:
        // Both world-bound fields must be set
        return !!(data.wgRegionId && data.locationId);
      default:
        return false;
    }
  };

  if (loading && !workflowId) {
    return <div className="container mt-4">Loading wizard...</div>;
  }

  if (error && !workflowId) {
    return <div className="container mt-4 alert alert-danger">{error}</div>;
  }

  const isLastStep = currentStep === TOWN_STEPS.length;

  return (
    <div className="container mt-4">
      <h1>Create New Town</h1>
      
      {error && <div className="alert alert-danger">{error}</div>}

      <WizardStepContainer
        steps={TOWN_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onFinalize={handleFinalize}
        canProceed={isStepValid() && !loading}
        isLastStep={isLastStep}
      >
        {currentStep === 1 && (
          <div className="step-form">
            <div className="form-group">
              <label>Town Name *</label>
              <input
                type="text"
                className="form-control"
                value={stepData[1].name || ''}
                onChange={(e) => handleStepDataChange('name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea
                className="form-control"
                rows={4}
                value={stepData[1].description || ''}
                onChange={(e) => handleStepDataChange('description', e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-form">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="allowEntry"
                checked={stepData[2].allowEntry ?? true}
                onChange={(e) => handleStepDataChange('allowEntry', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="allowEntry">
                Allow Entry
              </label>
            </div>
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="allowExit"
                checked={stepData[2].allowExit ?? true}
                onChange={(e) => handleStepDataChange('allowExit', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="allowExit">
                Allow Exit
              </label>
            </div>
          </div>
        )}

        {currentStep === 3 && workflowId && (
          <div className="step-form">
            <WorldBoundFieldRenderer
              fieldName="wgRegionId"
              fieldLabel="WorldGuard Region"
              workflowSessionId={workflowId}
              stepNumber={3}
              taskType="DefineRegion"
              value={stepData[3].wgRegionId}
              onChange={(value) => handleStepDataChange('wgRegionId', value)}
              allowExisting={false}
              allowCreate={true}
            />

            <WorldBoundFieldRenderer
              fieldName="locationId"
              fieldLabel="Spawn Location"
              workflowSessionId={workflowId}
              stepNumber={3}
              taskType="CaptureLocation"
              value={stepData[3].locationId}
              onChange={(value) => handleStepDataChange('locationId', value)}
              allowExisting={false}
              allowCreate={true}
            />
          </div>
        )}
      </WizardStepContainer>
    </div>
  );
};
