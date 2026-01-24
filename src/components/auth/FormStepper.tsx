import React from 'react';
import { ChevronRight } from 'lucide-react';

interface FormStepperProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

/**
 * Multi-step form stepper with visual progress indicator
 * Displays numbered steps with connection lines
 */
export const FormStepper: React.FC<FormStepperProps> = ({
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="mb-8">
      {/* Desktop stepper (horizontal) */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              {/* Step circle */}
              <button
                onClick={() => onStepClick?.(index)}
                disabled={!onStepClick}
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-all ${
                  index === currentStep
                    ? 'bg-primary text-white shadow-lg'
                    : index < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                } ${onStepClick ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
                aria-current={index === currentStep ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${steps.length}: ${step}`}
              >
                {index < currentStep ? '✓' : index + 1}
              </button>

              {/* Connection line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-colors ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step labels */}
        <div className="flex justify-between mt-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`text-xs font-medium text-center flex-1 ${
                index === currentStep
                  ? 'text-primary'
                  : index < currentStep
                    ? 'text-green-600'
                    : 'text-gray-500'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile stepper (vertical/compact) */}
      <div className="sm:hidden">
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </div>
            <div className="text-lg font-bold text-primary">{steps[currentStep]}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label={`Progress: Step ${currentStep + 1} of ${steps.length}`}
          />
        </div>
      </div>
    </div>
  );
};
