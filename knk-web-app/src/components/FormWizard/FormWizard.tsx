import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, Check } from 'lucide-react';
import { FormConfigurationDto, FormStepDto, StepData, AllStepsData, FormSubmissionProgressDto } from '../../utils/domain/dto/forms/FormModels';
import { formConfigClient } from '../../io/formConfigClient';
import { formSubmissionClient } from '../../io/formSubmissionClient';
import { ConditionEvaluator } from '../../utils/conditionEvaluator';
import { FormSubmissionStatus } from '../../utils/enums';
import { FieldRenderer } from './FieldRenderers';
import { logging } from '../../utils';

interface FormWizardProps {
    entityName: string;
    userId: string;
    onComplete?: (data: AllStepsData) => void;
    existingProgressId?: string;
}

export const FormWizard: React.FC<FormWizardProps> = ({
    entityName,
    userId,
    onComplete,
    existingProgressId
}) => {
    const [config, setConfig] = useState<FormConfigurationDto | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [currentStepData, setCurrentStepData] = useState<StepData>({});
    const [allStepsData, setAllStepsData] = useState<AllStepsData>({});
    const [errors, setErrors] = useState<{ [fieldName: string]: string }>({});
    const [progressId, setProgressId] = useState<string | undefined>(existingProgressId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfiguration();
    }, [entityName, existingProgressId]);

    const loadConfiguration = async () => {
        try {
            setLoading(true);
            
            if (existingProgressId) {
                const progress = await formSubmissionClient.getById(existingProgressId);
                setProgressId(progress.id);
                setConfig(progress.configuration!);
                setCurrentStepIndex(progress.currentStepIndex);
                setCurrentStepData(JSON.parse(progress.currentStepDataJson || '{}'));
                setAllStepsData(JSON.parse(progress.allStepsDataJson || '{}'));
            } else {
                const fetchedConfig = await formConfigClient.getByEntity(entityName, true);
                setConfig(fetchedConfig);
                
                // Initialize with default values
                const initialData: StepData = {};
                fetchedConfig.steps[0]?.fields.forEach(field => {
                    if (field.defaultValue) {
                        initialData[field.fieldName] = field.defaultValue;
                    }
                });
                setCurrentStepData(initialData);
            }
        } catch (error) {
            console.error('Failed to load form configuration:', error);
            logging.errorHandler.next('ErrorMessage.UIConfigurations.LoadFailed');
        } finally {
            setLoading(false);
        }
    };

    const currentStep = config?.steps[currentStepIndex];
    const orderedFields = currentStep?.fields.sort((a, b) => a.order - b.order) || [];

    const handleFieldChange = (fieldName: string, value: any) => {
        setCurrentStepData(prev => ({ ...prev, [fieldName]: value }));
        // Clear error when user types
        if (errors[fieldName]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    };

    const validateField = (field: any): string | null => {
        const value = currentStepData[field.fieldName];

        if (field.isRequired && (value === null || value === undefined || value === '')) {
            return `${field.label} is required`;
        }

        for (const validation of field.validations) {
            if (!validation.isActive) continue;

            const params = validation.parametersJson ? JSON.parse(validation.parametersJson) : {};
            
            // Add validation logic based on ValidationType
            // For brevity, showing Required only
        }

        return null;
    };

    const validateStep = (): boolean => {
        const newErrors: { [fieldName: string]: string } = {};
        let isValid = true;

        orderedFields.forEach(field => {
            // Check dependency conditions
            if (field.dependencyConditionJson) {
                const conditionMet = ConditionEvaluator.evaluateConditions(
                    field.dependencyConditionJson,
                    currentStepData,
                    allStepsData
                );
                if (!conditionMet) return; // Skip validation if field is hidden
            }

            const error = validateField(field);
            if (error) {
                newErrors[field.fieldName] = error;
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    const saveProgress = async (status: FormSubmissionStatus = FormSubmissionStatus.Draft) => {
        try {
            setSaving(true);
            const progressData: FormSubmissionProgressDto = {
                id: progressId,
                formConfigurationId: config!.id!,
                userId,
                currentStepIndex,
                currentStepDataJson: JSON.stringify(currentStepData),
                allStepsDataJson: JSON.stringify({ ...allStepsData, [currentStepIndex]: currentStepData }),
                status,
            };

            if (progressId) {
                await formSubmissionClient.update(progressData);
            } else {
                const created = await formSubmissionClient.create(progressData);
                setProgressId(created.id);
            }
        } catch (error) {
            console.error('Failed to save progress:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.SaveFailed');
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        if (!validateStep()) return;

        // Check step completion conditions
        if (currentStep?.conditions) {
            for (const condition of currentStep.conditions) {
                if (condition.conditionType === 'Completion' && condition.isActive) {
                    const met = ConditionEvaluator.evaluateConditions(
                        condition.conditionJson,
                        currentStepData,
                        { ...allStepsData, [currentStepIndex]: currentStepData }
                    );
                    if (!met) {
                        logging.errorHandler.next(condition.errorMessage || 'Step completion conditions not met');
                        return;
                    }
                }
            }
        }

        const updatedAllData = { ...allStepsData, [currentStepIndex]: currentStepData };
        setAllStepsData(updatedAllData);

        if (currentStepIndex < config!.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setCurrentStepData({});
            setErrors({});
            await saveProgress(FormSubmissionStatus.InProgress);
        } else {
            // Complete the form
            await saveProgress(FormSubmissionStatus.Completed);
            onComplete?.(updatedAllData);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setAllStepsData(prev => ({ ...prev, [currentStepIndex]: currentStepData }));
            setCurrentStepIndex(prev => prev - 1);
            setCurrentStepData(allStepsData[currentStepIndex - 1] || {});
            setErrors({});
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading form...</p>
                </div>
            </div>
        );
    }

    if (!config || !currentStep) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">No form configuration found for {entityName}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
            {/* Progress Bar */}
            <div className="px-8 pt-8">
                <div className="flex items-center justify-between mb-4">
                    {config.steps.map((step, index) => (
                        <div key={step.id} className="flex items-center flex-1">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    index < currentStepIndex
                                        ? 'bg-green-500 text-white'
                                        : index === currentStepIndex
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                            >
                                {index < currentStepIndex ? <Check className="h-5 w-5" /> : index + 1}
                            </div>
                            {index < config.steps.length - 1 && (
                                <div
                                    className={`flex-1 h-1 mx-2 ${
                                        index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">{currentStep.title}</h2>
                    {currentStep.description && (
                        <p className="mt-2 text-sm text-gray-600">{currentStep.description}</p>
                    )}
                </div>
            </div>

            {/* Form Fields */}
            <div className="px-8 py-6 space-y-6">
                {orderedFields.map(field => {
                    const shouldShow = !field.dependencyConditionJson ||
                        ConditionEvaluator.evaluateConditions(
                            field.dependencyConditionJson,
                            currentStepData,
                            allStepsData
                        );

                    if (!shouldShow) return null;

                    return (
                        <FieldRenderer
                            key={field.id}
                            field={field}
                            value={currentStepData[field.fieldName]}
                            onChange={value => handleFieldChange(field.fieldName, value)}
                            error={errors[field.fieldName]}
                            onBlur={() => validateField(field)}
                        />
                    );
                })}
            </div>

            {/* Navigation Buttons */}
            <div className="px-8 py-6 bg-gray-50 rounded-b-lg flex justify-between">
                <button
                    onClick={handlePrevious}
                    disabled={currentStepIndex === 0}
                    className="btn-secondary disabled:opacity-50"
                >
                    <ChevronLeft className="h-5 w-5 mr-2" />
                    Previous
                </button>
                <button
                    onClick={() => saveProgress()}
                    disabled={saving}
                    className="btn-secondary"
                >
                    <Save className="h-5 w-5 mr-2" />
                    {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                    onClick={handleNext}
                    className="btn-primary"
                >
                    {currentStepIndex === config.steps.length - 1 ? 'Complete' : 'Next'}
                    <ChevronRight className="h-5 w-5 ml-2" />
                </button>
            </div>
        </div>
    );
};
