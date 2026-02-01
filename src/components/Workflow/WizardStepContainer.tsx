import React from 'react';
import { StepDefinition } from '../../types/workflow';

interface WizardStepContainerProps {
  steps: StepDefinition[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onFinalize?: () => void;
  canProceed: boolean;
  isLastStep: boolean;
  children: React.ReactNode;
}

export const WizardStepContainer: React.FC<WizardStepContainerProps> = ({
  steps,
  currentStep,
  onStepChange,
  onNext,
  onPrevious,
  onFinalize,
  canProceed,
  isLastStep,
  children
}) => {
  const currentStepDef = steps[currentStep - 1];

  return (
    <div className="wizard-container">
      {/* Step Indicator */}
      <div className="wizard-steps-indicator">
        {steps.map((step, index) => (
          <div
            key={step.stepNumber}
            className={`step-indicator ${
              index + 1 === currentStep
                ? 'active'
                : index + 1 < currentStep
                ? 'completed'
                : ''
            }`}
            onClick={() => index + 1 < currentStep && onStepChange(index + 1)}
          >
            <span className="step-number">{step.stepNumber}</span>
            <span className="step-name">{step.name}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="wizard-step-content">
        <h2>{currentStepDef?.name}</h2>
        <div className="wizard-step-body">{children}</div>
      </div>

      {/* Navigation */}
      <div className="wizard-navigation">
        <button
          onClick={onPrevious}
          disabled={currentStep === 1}
          className="btn btn-secondary"
        >
          Previous
        </button>
        
        {!isLastStep && (
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="btn btn-primary"
          >
            Next
          </button>
        )}
        
        {isLastStep && onFinalize && (
          <button
            onClick={onFinalize}
            disabled={!canProceed}
            className="btn btn-success"
          >
            Finalize
          </button>
        )}
      </div>
    </div>
  );
};
