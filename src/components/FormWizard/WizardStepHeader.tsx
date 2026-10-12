import React from 'react';
import { Check } from 'lucide-react';

/**
 * KNG-137: the wizard's progress bar and step title, kept out of FormWizard.tsx so its edit there
 * stays a thin call site.
 */

export interface WizardStepProgressItem {
    key: string | number;
    name?: string | null;
    isDone: boolean;
    isCurrent: boolean;
}

/**
 * Numbered step circles with the step name under each one. Names are truncated (full name on
 * hover) and hidden on narrow screens, where only the numbers fit.
 */
export const WizardStepProgress: React.FC<{ steps: WizardStepProgressItem[] }> = ({ steps }) => (
    <ol
        aria-label="Form steps"
        className="flex items-start justify-center mx-auto mb-6 w-full max-w-3xl px-2 md:px-4 gap-3 md:gap-4"
    >
        {steps.map((step, position) => {
            const name = step.name?.trim() || '';
            const label = name ? `Step ${position + 1}: ${name}` : `Step ${position + 1}`;
            return (
                <li
                    key={step.key}
                    title={name || undefined}
                    aria-label={label}
                    aria-current={step.isCurrent ? 'step' : undefined}
                    className="flex items-start gap-2 md:gap-3 min-w-0"
                >
                    <div className="flex flex-col items-center min-w-0">
                        <div
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex flex-shrink-0 items-center justify-center text-sm font-semibold transition-colors ${
                                step.isDone
                                    ? 'bg-green-500 text-white'
                                    : step.isCurrent
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-200 text-gray-600'
                            }`}
                        >
                            {step.isDone ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : position + 1}
                        </div>
                        {name && (
                            <span
                                data-testid="wizard-step-name"
                                className={`hidden md:block mt-1 max-w-[7rem] truncate text-center text-xs ${
                                    step.isCurrent ? 'font-semibold text-gray-900' : 'text-gray-500'
                                }`}
                            >
                                {name}
                            </span>
                        )}
                    </div>
                    {position < steps.length - 1 && (
                        <div
                            aria-hidden="true"
                            className={`mt-3.5 md:mt-[1.125rem] h-1 w-6 md:w-12 rounded-full transition-colors flex-shrink-0 ${
                                step.isDone ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                        />
                    )}
                </li>
            );
        })}
    </ol>
);

/**
 * The step name stays the title in edit mode too; "Edit {entity}" becomes a small heading above it.
 * A step without a name falls back to "Edit {entity}" as the title.
 */
export const WizardStepTitle: React.FC<{
    stepName?: string | null;
    description?: string | null;
    editingEntityName?: string | null;
}> = ({ stepName, description, editingEntityName }) => {
    const name = stepName?.trim() || '';
    const editLabel = editingEntityName ? `Edit ${editingEntityName}` : '';
    return (
        <div className="text-center mb-6">
            {editLabel && name && (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{editLabel}</p>
            )}
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{name || editLabel}</h2>
            {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
        </div>
    );
};
