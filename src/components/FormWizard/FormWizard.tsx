import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Save, Check, AlertCircle } from 'lucide-react';
import { FormConfigurationDto, FormStepDto, FormFieldDto, StepData, AllStepsData, FormSubmissionProgressDto } from '../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { ConditionEvaluator } from '../../utils/conditionEvaluator';
import { FormSubmissionStatus } from '../../utils/enums';
import { FieldRenderer } from './FieldRenderers';
import { logging } from '../../utils';
import { getFetchByIdFunctionForEntity } from '../../utils/entityApiMapping';
import { findValueByFieldName } from '../../utils/fieldNameMapper';
import { normalizeFormSubmission } from '../../utils/forms/normalizeFormSubmission';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { FeedbackModal } from '../FeedbackModal';
import { ChildFormModal } from './ChildFormModal';
import { ManyToManyRelationshipEditor } from './ManyToManyRelationshipEditor';
import { workflowClient } from '../../apiClients/workflowClient';
import { StepProgressReadDto } from '../../types/dtos/workflow/WorkflowDtos';

interface FormWizardProps {
    entityName: string;
    entityId?: string; // added: optional entity ID for edit mode
    userId: string;
    onComplete?: (data: Record<string, unknown>, progress?: FormSubmissionProgressDto) => void;
    existingProgressId?: string;
    parentProgressId?: string; // added: for nested child forms
    fieldName?: string; // added: field name this child form is for
    currentStepIndex?: number; // added: step index where child form is being created
    // workflow integration (optional)
    workflowSessionId?: number;
    onStepAdvanced?: (args: { from: number; to: number; stepKey: string }) => void;
    worldTaskHint?: string;
}

export const FormWizard: React.FC<FormWizardProps> = ({
    entityName,
    entityId: initialEntityId, // Rename to make clear this is the initial prop
    userId,
    onComplete,
    existingProgressId,
    parentProgressId, // added
    workflowSessionId,
    onStepAdvanced,
    worldTaskHint
    // Note: fieldName and currentStepIndex props removed as unused
}) => {
    const [config, setConfig] = useState<FormConfigurationDto | null>(null);
    const [entityMetadata, setEntityMetadata] = useState<EntityMetadataDto | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [currentStepData, setCurrentStepData] = useState<StepData>({});
    const [allStepsData, setAllStepsData] = useState<AllStepsData>({});
    const [errors, setErrors] = useState<{ [fieldName: string]: string }>({});
    const [progressId, setProgressId] = useState<string | undefined>(existingProgressId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    // CRITICAL: Track entityId in state so it persists when loading from progress
    const [entityId, setEntityId] = useState<string | undefined>(initialEntityId);

    type SaveFeedbackState = {
        open: boolean;
        title: string;
        message: string;
        status: 'success' | 'error' | 'info';
    };
    const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState>({
        open: false,
        title: '',
        message: '',
        status: 'info'
    });
    const autoCloseRef = useRef<number | undefined>(undefined);

    // added: state for child form modal
    type ChildFormState = {
        open: boolean;
        entityTypeName: string;
        fieldName: string;
    };
    const [childFormModal, setChildFormModal] = useState<ChildFormState>({
        open: false,
        entityTypeName: '',
        fieldName: ''
    });

    const clearAutoClose = () => {
        if (autoCloseRef.current) {
            window.clearTimeout(autoCloseRef.current);
            autoCloseRef.current = undefined;
        }
    };

    const closeSaveModal = () => {
        clearAutoClose();
        setSaveFeedback(prev => ({ ...prev, open: false }));
    };

    useEffect(() => {
        return () => clearAutoClose();
    }, []);

    // Helpers to enforce full field shape per step and flatten for DTO
    const normalizeStepData = (step: FormStepDto, data: StepData | undefined): StepData => {
        const result: StepData = {};
        step.fields
            .sort((a, b) => a.order - b.order)
            .forEach(field => {
                const hasValue = data && Object.prototype.hasOwnProperty.call(data, field.fieldName);
                const value = hasValue ? (data as StepData)[field.fieldName] : (field.defaultValue ?? null);
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

    const flattenAllStepsData = (cfg: FormConfigurationDto, stepsData: AllStepsData): Record<string, unknown> => {
        const flat: Record<string, unknown> = {};
        cfg.steps.forEach((step, idx) => {
            step.fields.forEach(field => {
                const val = stepsData?.[idx]?.[field.fieldName];
                flat[field.fieldName] = val ?? field.defaultValue ?? null;
            });
        });
        return flat;
    };

    const loadConfiguration = React.useCallback(async () => {
        try {
            setLoading(true);
            // CRITICAL: Use initialEntityId prop directly, not the state variable
            // The state update hasn't propagated yet when this effect runs
            const currentEntityId = initialEntityId;
            
            if (existingProgressId) {
                const progress = await formSubmissionClient.getById(existingProgressId);
                setProgressId(progress.id);
                
                // CRITICAL: Restore entityId from progress if it exists (edit mode)
                if (progress.entityId) {
                    setEntityId(progress.entityId);
                }

                const fetchedCfg = await formConfigClient.getById(progress.formConfigurationId);
                setConfig(fetchedCfg);

                setCurrentStepIndex(progress.currentStepIndex);

                const parsedCurrent = JSON.parse(progress.currentStepDataJson || '{}');
                const parsedAll = JSON.parse(progress.allStepsDataJson || '{}');

                // Ensure all fields present with null/defaults
                setCurrentStepData(normalizeStepData(fetchedCfg.steps[progress.currentStepIndex], parsedCurrent));
                setAllStepsData(normalizeAllStepsData(fetchedCfg, parsedAll));

                // Load entity metadata for normalization
                if (progress.entityTypeName) {
                    const metadata = await metadataClient.getEntityMetadata(progress.entityTypeName);
                    setEntityMetadata(metadata);
                }
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
                if (currentEntityId) {
                    setEntityId(currentEntityId); // Update state for use in other places
                    await loadExistingEntityData(entityName, currentEntityId, fetchedConfig);
                } else {
                    // Initialize all fields for step 0 to default/null
                    const initialData: StepData = normalizeStepData(fetchedConfig.steps[0], {});
                    setCurrentStepData(initialData);

                    // Initialize allStepsData for all steps
                    setAllStepsData(normalizeAllStepsData(fetchedConfig, {} as AllStepsData));
                }

                // Load entity metadata for normalization
                const metadata = await metadataClient.getEntityMetadata(entityName);
                setEntityMetadata(metadata);
            }
        } catch (error) {
            console.error('Failed to load form configuration:', error);
            logging.errorHandler.next('ErrorMessage.UIConfigurations.LoadFailed');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityName, existingProgressId, initialEntityId]);

    useEffect(() => {
        loadConfiguration();
    }, [loadConfiguration]);

    // Load workflow step progress if workflow session is active
    useEffect(() => {
        const fetchProgress = async () => {
            if (!workflowSessionId) return;
            try {
                const steps: StepProgressReadDto[] = await workflowClient.getProgress(workflowSessionId);
                const set = new Set<number>();
                steps.filter(s => (s.status || '').toLowerCase() === 'completed')
                     .forEach(s => set.add(s.stepIndex));
                setCompletedSteps(set);
            } catch {
                // ignore errors; non-blocking
            }
        };
        void fetchProgress();
    }, [workflowSessionId]);

    // changed: simplified using utility function
    const loadExistingEntityData = async (entityTypeName: string, id: string, cfg: FormConfigurationDto) => {
        try {
            const entityData: Record<string, unknown> = await getFetchByIdFunctionForEntity(entityTypeName)(id);
            
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

    const computeStepKey = (step: FormStepDto, index: number): string => {
        const key = step.stepName?.trim();
        return key && key.length > 0 ? key : `step-${index + 1}`;
    };

    const parseWorldTaskSettings = (settingsJson?: string): { enabled?: boolean; taskType?: string } => {
        if (!settingsJson) return {};
        try {
            const parsed = JSON.parse(settingsJson);
            if (parsed && typeof parsed === 'object' && parsed.worldTask) {
                return {
                    enabled: !!parsed.worldTask.enabled,
                    taskType: parsed.worldTask.taskType
                };
            }
        } catch {}
        return {};
    };

    const handleFieldChange = (fieldName: string, value: unknown) => {
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

    // added: open child form modal for creating new object
    const handleOpenChildForm = (field: FormFieldDto) => {
        setChildFormModal({
            open: true,
            entityTypeName: field.objectType || '',
            fieldName: field.fieldName
        });
    };

    // added: close child form modal
    const handleCloseChildForm = () => {
        setChildFormModal(prev => ({ ...prev, open: false }));
    };

    // added: handle child form completion and data insertion
    const handleChildFormComplete = async (childData: Record<string, unknown>) => {
        const fieldName = childFormModal.fieldName;

        try {
            // Extract ID from the created entity if it exists
            // The normalizeFormSubmission will handle the conversion from navigation property to foreign key
            // but we want to store the full object in the form state for display purposes
            const createdEntity = childData;

            console.log(`Child form completed for field: ${fieldName}`, {
                entityType: childFormModal.entityTypeName,
                childData: createdEntity,
                extractedId: createdEntity?.id
            });

            // If this is a child form (has parentProgressId), save to childProgresses
            if (parentProgressId && progressId && currentStepIndex !== undefined) {
                // Save child progress to parent's childProgresses array
                const childProgress: FormSubmissionProgressDto = {
                    id: undefined,
                    formConfigurationId: config!.id!,
                    userId,
                    entityTypeName: childFormModal.entityTypeName,
                    currentStepIndex: 0,
                    currentStepDataJson: JSON.stringify(childData),
                    allStepsDataJson: JSON.stringify({ 0: childData }),
                    parentProgressId: parentProgressId,
                    status: FormSubmissionStatus.Completed
                };

                // Create the child progress in the backend
                await formSubmissionClient.create(childProgress);

                // Insert the entity data into the field
                // Store the full object for display, normalizeFormSubmission will extract ID when submitting
                setCurrentStepData(prev => ({
                    ...prev,
                    [childFormModal.fieldName]: createdEntity
                }));
            } else {
                // Regular child form: insert data directly into the field
                // Store the full object for display, normalizeFormSubmission will extract ID when submitting
                setCurrentStepData(prev => ({
                    ...prev,
                    [fieldName]: createdEntity
                }));
            }

            handleCloseChildForm();
        } catch (error) {
            console.error('Failed to complete child form:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.ChildFormFailed');
        }
    };

    const validateField = (field: FormFieldDto): string | null => {
        const value = currentStepData[field.fieldName];

        if (field.isRequired && (value === null || value === undefined || value === '')) {
            return `${field.label} is required`;
        }

        for (const validation of field.validations) {
            if (!validation.isActive) continue;

            // Parse validation parameters if needed (commented: validation logic placeholder)
            // const params = validation.parametersJson ? JSON.parse(validation.parametersJson) : {};
            
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
                entityId: entityId, // CRITICAL: preserve entityId for edit mode
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
            // Only surface modal feedback for explicit draft saves to avoid interrupting step navigation
            if (status === FormSubmissionStatus.Paused) {
                setSaveFeedback({
                    open: true,
                    title: 'Progress saved',
                    message: 'Your draft has been saved. You can continue later.',
                    status: 'success'
                });
                clearAutoClose();
                autoCloseRef.current = window.setTimeout(() => {
                    closeSaveModal();
                }, 3000);
            }

            // changed: return true on success so caller knows save succeeded
            return true;
        } catch (error: unknown) {
            console.error('Failed to save progress:', error);
            // changed: set user-friendly error message from API or fallback
            const errorMessage = 
                (error && typeof error === 'object' && 'response' in error && 
                 error.response && typeof error.response === 'object' && 'data' in error.response &&
                 error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data &&
                 typeof error.response.data.message === 'string')
                    ? error.response.data.message
                    : 'Failed to save your progress. Please try again.';
            setError(errorMessage);
            logging.errorHandler.next('ErrorMessage.FormSubmission.SaveFailed');
            if (status === FormSubmissionStatus.Paused) {
                setSaveFeedback({
                    open: true,
                    title: 'Save failed',
                    message: errorMessage,
                    status: 'error'
                });
                clearAutoClose();
            }
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
                // notify workflow about step advancement (complete current step)
                try {
                    const stepKey = computeStepKey(currentStep!, prev);
                    onStepAdvanced?.({ from: prev, to: nextIndex, stepKey });
                    setCompletedSteps(prevSet => new Set<number>([...Array.from(prevSet), prev]));
                } catch {}
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
                entityMetadata: entityMetadata?.fields || []
            });

            // CRITICAL: Include entity ID in payload for edit mode
            // This ensures the parent component calls UPDATE instead of CREATE
            if (entityId) {
                normalizedPayload.id = entityId;
            }

            console.log('Raw form data (flattened):', flattenedDto);
            console.log('Normalized payload for API (with IDs extracted):', normalizedPayload);
            console.log('Edit mode:', !!entityId, 'Entity ID:', entityId);

            // notify workflow for final step as well
            try {
                const stepKey = computeStepKey(currentStep!, currentStepIndex);
                onStepAdvanced?.({ from: currentStepIndex, to: currentStepIndex, stepKey });
                setCompletedSteps(prevSet => new Set<number>([...Array.from(prevSet), currentStepIndex]));
            } catch {}

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
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header Section: Progress Bar, Title, and Navigation */}
            <div className="px-6 md:px-8 pt-6 md:pt-8 pb-4 md:pb-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
                {/* added: error banner */}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    </div>
                )}

                {/* Progress Indicator */}
                <div className="flex items-center justify-center mx-auto mb-6 w-full max-w-3xl px-2 md:px-4 gap-3 md:gap-4">
                    {config.steps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                            <div
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                                    (index < currentStepIndex || completedSteps.has(index))
                                        ? 'bg-green-500 text-white'
                                        : index === currentStepIndex
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                            >
                                {(index < currentStepIndex || completedSteps.has(index)) ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : index + 1}
                            </div>
                            {index < config.steps.length - 1 && (
                                <div
                                    className={`h-1 w-10 md:w-16 rounded-full transition-colors flex-shrink-0 ${
                                        (index < currentStepIndex || completedSteps.has(index)) ? 'bg-green-500' : 'bg-gray-200'
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Title and Description */}
                <div className="text-center mb-6">
                    {/* changed: show edit mode in title */}
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                        {entityId ? `Edit ${entityName}` : currentStep.title}
                    </h2>
                    {currentStep.description && (
                        <p className="mt-2 text-sm text-gray-600">{currentStep.description}</p>
                    )}
                </div>

                {/* Navigation Buttons Toolbar */}
                <div className="flex flex-col md:flex-row gap-3 md:gap-2 justify-between items-center">
                    <button
                        onClick={handlePrevious}
                        disabled={currentStepIndex === 0}
                        className="w-full md:w-auto btn-secondary disabled:opacity-50 flex items-center justify-center"
                    >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        Previous
                    </button>

                    <button
                        onClick={handleSaveDraft}
                        className="w-full md:w-auto btn-tertiary flex items-center justify-center"
                    >
                        <Save className="h-5 w-5 mr-2" />
                        Save Draft
                    </button>

                    <button
                        onClick={handleNext}
                        className="w-full md:w-auto btn-primary flex items-center justify-center disabled:opacity-50"
                        disabled={saving}
                    >
                        {saving ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        ) : (
                            <ChevronRight className="h-5 w-5 mr-2" />
                        )}
                        {saving ? 'Submitting...' : currentStepIndex === config.steps.length - 1 ? 'Submit' : 'Next'}
                    </button>
                </div>
            </div>

            {/* Form Fields */}
            <div className="px-6 md:px-8 py-6 md:py-8 space-y-6">
                {currentStep.isManyToManyRelationship ? (
                    /* Many-to-Many Relationship Step */
                    <ManyToManyRelationshipEditor
                        step={currentStep}
                        value={currentStepData[currentStep.relatedEntityPropertyName || 'relationships'] || []}
                        onChange={(value) => handleFieldChange(currentStep.relatedEntityPropertyName || 'relationships', value)}
                        entityName={entityName}
                    />
                ) : (
                    /* Standard Field-Based Step */
                    orderedFields.map(field => {
                        const shouldShow = !field.dependencyConditionJson ||
                            ConditionEvaluator.evaluateConditions(
                                field.dependencyConditionJson,
                                currentStepData,
                                allStepsData
                            );

                        if (!shouldShow) return null;

                        const element = (
                            <FieldRenderer
                                key={field.id}
                                field={field}
                                value={currentStepData[field.fieldName]}
                                onChange={value => handleFieldChange(field.fieldName, value)}
                                error={errors[field.fieldName]}
                                onBlur={() => validateField(field)}
                                onCreateNew={() => handleOpenChildForm(field)}
                            />
                        );

                        // Optionally render WorldTask CTA when enabled in settings and workflow active
                        const { enabled, taskType } = parseWorldTaskSettings(field.settingsJson);
                        const stepKey = computeStepKey(currentStep!, currentStepIndex);
                        return (
                            <div key={field.id}>
                                {element}
                                {enabled && workflowSessionId != null && (
                                    // Lazy import to avoid circular deps
                                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                                    React.createElement(require('../Workflow/WorldTaskCta').WorldTaskCta, {
                                        workflowSessionId,
                                        userId: parseInt(userId || '0', 10) || 0,
                                        stepKey,
                                        fieldName: field.fieldName,
                                        value: currentStepData[field.fieldName],
                                        taskType,
                                        hint: worldTaskHint,
                                        onCompleted: () => {
                                            // On completion, we can clear any hint or trigger re-render
                                        }
                                    })
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Feedback and Child Form Modals */}
            <FeedbackModal
                open={saveFeedback.open}
                title={saveFeedback.title}
                message={saveFeedback.message}
                status={saveFeedback.status}
                onClose={closeSaveModal}
                onContinue={closeSaveModal}
            />

            {/* added: child form modal for creating objects on-the-fly */}
            <ChildFormModal
                open={childFormModal.open}
                entityTypeName={childFormModal.entityTypeName}
                parentProgressId={progressId || ''}
                userId={userId}
                fieldName={childFormModal.fieldName}
                currentStepIndex={currentStepIndex}
                onComplete={handleChildFormComplete}
                onClose={handleCloseChildForm}
            />
        </div>
    );
};

