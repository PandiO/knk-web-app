import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, Check, AlertCircle } from 'lucide-react';
import { FormConfigurationDto, FormStepDto, StepData, AllStepsData, FormSubmissionProgressDto } from '../../utils/domain/dto/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { ConditionEvaluator } from '../../utils/conditionEvaluator';
import { FormSubmissionStatus } from '../../utils/enums';
import { FieldRenderer } from './FieldRenderers';
import { logging } from '../../utils';
import { getFetchByIdFunctionForEntity } from '../../utils/entityApiMapping';
import { findValueByFieldName } from '../../utils/fieldNameMapper';
import { normalizeFormSubmission } from '../../utils/forms/normalizeFormSubmission';

interface FormWizardProps {
    entityName: string;
    entityId?: string; // added: optional entity ID for edit mode
    userId: string;
    onComplete?: (data: any, progress?: FormSubmissionProgressDto) => void;
    existingProgressId?: string;
}

export const FormWizard: React.FC<FormWizardProps> = ({
    entityName,
    entityId, // added
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
    const [error, setError] = useState<string | null>(null);

    // Helpers to enforce full field shape per step and flatten for DTO
    const normalizeStepData = (step: FormStepDto, data: StepData | undefined): StepData => {
        const result: StepData = {};
        step.fields
            .sort((a, b) => a.order - b.order)
            .forEach(field => {
                const hasValue = data && Object.prototype.hasOwnProperty.call(data, field.fieldName);
                const value = hasValue ? (data as any)[field.fieldName] : (field.defaultValue ?? null);
                result[field.fieldName] = value;
            });
        return result;
    };

    const normalizeAllStepsData = (cfg: FormConfigurationDto, stepsData: AllStepsData): AllStepsData => {
        const normalized: AllStepsData = {};
        cfg.steps.forEach((step, idx) => {
            normalized[idx] = normalizeStepData(step, stepsData?.[idx]);
        });
        return normalized;
    };

    const flattenAllStepsData = (cfg: FormConfigurationDto, stepsData: AllStepsData): Record<string, any> => {
        const flat: Record<string, any> = {};
        cfg.steps.forEach((step, idx) => {
            step.fields.forEach(field => {
                const val = stepsData?.[idx]?.[field.fieldName];
                flat[field.fieldName] = val ?? field.defaultValue ?? null;
            });
        });
        return flat;
    };

    useEffect(() => {
        loadConfiguration();
    }, [entityName, existingProgressId, entityId]); // added entityId dependency

    const loadConfiguration = async () => {
        try {
            setLoading(true);
            
            if (existingProgressId) {
                const progress = await formSubmissionClient.getById(existingProgressId);
                setProgressId(progress.id);

                const fetchedCfg = await formConfigClient.getById(progress.formConfigurationId);
                setConfig(fetchedCfg);

                setCurrentStepIndex(progress.currentStepIndex);

                const parsedCurrent = JSON.parse(progress.currentStepDataJson || '{}');
                const parsedAll = JSON.parse(progress.allStepsDataJson || '{}');

                // Ensure all fields present with null/defaults
                setCurrentStepData(normalizeStepData(fetchedCfg.steps[progress.currentStepIndex], parsedCurrent));
                setAllStepsData(normalizeAllStepsData(fetchedCfg, parsedAll));
            } else {
                if (!entityName) {
                    throw new Error('Entity name is required to load form configuration');
                }
                const fetchedConfig = await formConfigClient.getByEntityTypeName(entityName, true).then((config: FormConfigurationDto | FormConfigurationDto[] | undefined) => {
                    if (!config) {
                        throw new Error(`No default form configuration found for entity: ${entityName}`);
                    }
                    if (Array.isArray(config)) {
                        throw new Error(`Expected single form configuration but received array for entity: ${entityName}`);
                    }
                    return config;
                });
                setConfig(fetchedConfig);
                
                // changed: if entityId provided, load existing entity data
                if (entityId) {
                    await loadExistingEntityData(entityName, entityId, fetchedConfig);
                } else {
                    // Initialize all fields for step 0 to default/null
                    const initialData: StepData = normalizeStepData(fetchedConfig.steps[0], {});
                    setCurrentStepData(initialData);

                    // Initialize allStepsData for all steps
                    setAllStepsData(normalizeAllStepsData(fetchedConfig, {} as AllStepsData));
                }
            }
        } catch (error) {
            console.error('Failed to load form configuration:', error);
            logging.errorHandler.next('ErrorMessage.UIConfigurations.LoadFailed');
        } finally {
            setLoading(false);
        }
    };

    // changed: simplified using utility function
    const loadExistingEntityData = async (entityTypeName: string, id: string, cfg: FormConfigurationDto) => {
        try {
            const entityData: any = await getFetchByIdFunctionForEntity(entityTypeName)(id);
            
            const populatedStepsData: AllStepsData = {};
            cfg.steps.forEach((step, stepIndex) => {
                const stepData: StepData = {};
                step.fields.forEach(field => {
                    // Use utility function for case-insensitive lookup
                    const value = findValueByFieldName(entityData, field.fieldName);
                    stepData[field.fieldName] = value !== undefined ? value : (field.defaultValue ?? null);
                });
                populatedStepsData[stepIndex] = stepData;
            });

            setAllStepsData(populatedStepsData);
            setCurrentStepData(populatedStepsData[0] || normalizeStepData(cfg.steps[0], {}));
        } catch (error) {
            console.error('Failed to load existing entity data:', error);
            logging.errorHandler.next(`ErrorMessage.${entityTypeName}.LoadFailed`);
            const initialData: StepData = normalizeStepData(cfg.steps[0], {});
            setCurrentStepData(initialData);
            setAllStepsData(normalizeAllStepsData(cfg, {} as AllStepsData));
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
        console.log(`Field ${fieldName} changed to`, value);
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
        // changed: clear page-level error when validating fields
        if (isValid) {
            setError(null);
        }
        return isValid;
    };

    const getProgressData = (): FormSubmissionProgressDto | null => {
        const mergedAllSteps = { ...allStepsData, [currentStepIndex]: normalizeStepData(config!.steps[currentStepIndex], currentStepData) };
        const progressData: FormSubmissionProgressDto = {
                id: progressId,
                formConfigurationId: config!.id!,
                userId,
                entityTypeName: entityName,
                entityId: entityId,
                currentStepIndex,
                currentStepDataJson: JSON.stringify(normalizeStepData(config!.steps[currentStepIndex], currentStepData)),
                allStepsDataJson: JSON.stringify(mergedAllSteps),
                status: FormSubmissionStatus.InProgress,
                updatedAt: new Date().toISOString(),
            };
        return progressData;
    };

    const saveProgress = async (status: FormSubmissionStatus = FormSubmissionStatus.Paused) => {
        try {
            setSaving(true);
            // changed: clear error before attempting save
            setError(null);

            const progressData = getProgressData();
            if (!progressData) {
                throw new Error('No progress data to save');
            }
            progressData.status = status;

            if (progressId) {
                await formSubmissionClient.update(progressData);
            } else {
                const created = await formSubmissionClient.create(progressData);
                setProgressId(created.id);
            }
            // changed: return true on success so caller knows save succeeded
            return true;
        } catch (error: any) {
            console.error('Failed to save progress:', error);
            // changed: set user-friendly error message from API or fallback
            const errorMessage = error?.response?.data?.message || 'Failed to save your progress. Please try again.';
            setError(errorMessage);
            logging.errorHandler.next('ErrorMessage.FormSubmission.SaveFailed');
            // changed: return false to indicate failure
            return false;
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

        // Ensure current step includes all fields
        const normalizedCurrent = normalizeStepData(currentStep!, currentStepData);
        const updatedAllData = { ...allStepsData, [currentStepIndex]: normalizedCurrent };
        setAllStepsData(updatedAllData);

        if (currentStepIndex < config!.steps.length - 1) {
            const saved = await saveProgress(FormSubmissionStatus.InProgress);
            if (!saved) return;

            // Advance and initialize next step data to defaults/nulls
            setCurrentStepIndex(prev => {
                const nextIndex = prev + 1;
                setCurrentStepData(normalizeStepData(config!.steps[nextIndex], updatedAllData[nextIndex] || {}));
                setErrors({});
                return nextIndex;
            });
        } else {
            const saved = await saveProgress(FormSubmissionStatus.Completed);
            if (!saved) return;

            // Flatten to get all field values
            const normalizedAll = normalizeAllStepsData(config!, updatedAllData);
            const flattenedDto = flattenAllStepsData(config!, normalizedAll);

            // changed: normalize the form data before sending to API
            // This converts nested objects (e.g., parentCategory) to foreign keys (e.g., parentCategoryId)
            const normalizedPayload = normalizeFormSubmission({
                entityTypeName: entityName,
                formConfiguration: config!,
                rawFormValue: flattenedDto,
                // entityMetadata can be passed here if available from parent component
            });

            console.log('Raw form data:', flattenedDto);
            console.log('Normalized payload for API:', normalizedPayload);

            onComplete?.(normalizedPayload, getProgressData()!);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setError(null);
            // Persist normalized current step before going back
            setAllStepsData(prev => ({ ...prev, [currentStepIndex]: normalizeStepData(currentStep!, currentStepData) }));
            setCurrentStepIndex(prev => {
                const previousIndex = prev - 1;
                setCurrentStepData(normalizeStepData(config!.steps[previousIndex], allStepsData[previousIndex] || {}));
                setErrors({});
                return previousIndex;
            });
        }
    };

    // changed: add explicit save draft handler
    const handleSaveDraft = async () => {
        const saved = await saveProgress(FormSubmissionStatus.Paused);
        if (saved) {
            // Optional: show success message
            console.log('Draft saved successfully');
        }
    };

    // changed: update form title to indicate edit mode
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
                {/* added: error banner */}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    </div>
                )}

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
                    {/* changed: show edit mode in title */}
                    <h2 className="text-2xl font-bold text-gray-900">
                        {entityId ? `Edit ${entityName}` : currentStep.title}
                    </h2>
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
                    onClick={handleSaveDraft}
                    className="btn-tertiary"
                >
                    <Save className="h-5 w-5 mr-2" />
                    Save Draft
                </button>
                <button
                    onClick={handleNext}
                    className="btn-primary"
                    disabled={saving}
                >
                    {saving ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <>
                            <ChevronRight className="h-5 w-5 mr-2" />
                            {currentStepIndex === config.steps.length - 1 ? 'Submit' : 'Next'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
