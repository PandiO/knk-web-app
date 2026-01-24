import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, GripVertical, Trash2, AlertCircle, Loader2, Copy } from 'lucide-react';
import { FormConfigurationDto, FormStepDto, FormFieldDto, ReuseLinkMode } from '../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formStepClient } from '../../apiClients/formStepClient';
import { formFieldClient } from '../../apiClients/formFieldClient';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto, FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { logging } from '../../utils';
import { StepEditor } from './StepEditor';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableStepItem } from './SortableStepItem';
import { FeedbackModal } from '../FeedbackModal';
import { ReusableStepSelector } from './ReusableStepSelector';
import { ConfigurationHealthPanel } from './ConfigurationHealthPanel';

export const FormConfigBuilder: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const configId = id || 'new';
    const isEditMode = configId !== 'new';

    const [config, setConfig] = useState<FormConfigurationDto>({
        entityTypeName: '',
        configurationName: '',
        description: '',
        isDefault: false,
        isActive: true,
        steps: []
    });

    const [reusableSteps, setReusableSteps] = useState<FormStepDto[]>([]);
    const [reusableFields, setReusableFields] = useState<FormFieldDto[]>([]);
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showStepSelector, setShowStepSelector] = useState(false);
    const [metadata, setMetadata] = useState<EntityMetadataDto[]>([]);
    const [selectedEntityMeta, setSelectedEntityMeta] = useState<EntityMetadataDto | null>(null);
    const [addingTemplate, setAddingTemplate] = useState(false);
    const [healthRefreshToken, setHealthRefreshToken] = useState(0);
    const [healthIssueCount, setHealthIssueCount] = useState<number>(0);

    // added: state to track default conflict notification
    const [defaultConflictMsg, setDefaultConflictMsg] = useState<string | null>(null);

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

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const clearAutoClose = () => {
        if (autoCloseRef.current) {
            window.clearTimeout(autoCloseRef.current);
            autoCloseRef.current = undefined;
        }
    };

    useEffect(() => {
        return () => clearAutoClose();
    }, []);

    const closeSaveModal = () => {
        clearAutoClose();
        const shouldNavigate = saveFeedback.status === 'success';
        setSaveFeedback(prev => ({ ...prev, open: false }));
        if (shouldNavigate) {
            navigate('/admin/form-configurations');
        }
    };

    const handleSaveContinue = () => {
        clearAutoClose();
        setSaveFeedback(prev => ({ ...prev, open: false }));
        navigate('/admin/form-configurations');
    };

    useEffect(() => {
        loadData();
    }, [configId]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const entityParam = params.get('entity');
        const defaultFlag = params.get('default') === 'true';

        const loadMeta = async () => {
            try {
                const all = await metadataClient.getAllEntityMetadata();
                setMetadata(all);
                if (!isEditMode) {
                    const pre = entityParam
                        ? all.find(m => m.entityName.toLowerCase() === entityParam.toLowerCase())
                        : null;
                    if (pre) {
                        setConfig(prev => ({
                            ...prev,
                            entityTypeName: pre.entityName,
                            isDefault: defaultFlag ? true : prev.isDefault
                        }));
                        setSelectedEntityMeta(pre);
                    }
                }
            } catch (e) {
                console.error('Failed to load metadata', e);
                logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
            }
        };
        loadMeta();
    }, [configId, isEditMode]);

    useEffect(() => {
        if (config.entityTypeName) {
            const meta = metadata.find(m => m.entityName === config.entityTypeName) || null;
            setSelectedEntityMeta(meta);
        } else {
            setSelectedEntityMeta(null);
        }
    }, [config.entityTypeName, metadata]);

    const allFieldsInConfiguration = useMemo(() => {
        const collectFields = (steps: FormStepDto[]): FormFieldDto[] => {
            const directFields = steps.flatMap(s => s.fields || []);
            const childFields = steps.flatMap(s => collectFields(s.childFormSteps || []));
            return [...directFields, ...childFields];
        };
        return collectFields(config.steps || []);
    }, [config.steps]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Always load reusable templates (needed for both create and edit)
            const [stepsData, fieldsData] = await Promise.all([
                formConfigClient.getReusableSteps(),
                formConfigClient.getReusableFields()
            ]);

            setReusableSteps(stepsData);
            setReusableFields(fieldsData);

            // Only load existing config if editing (not creating new)
            if (isEditMode && configId) {
                const configData = await formConfigClient.getById(configId);
                setConfig(configData);
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            setError('Failed to load form configuration');
            logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
        } finally {
            setLoading(false);
        }
    };

    const generateTempId = () => `temp-${Date.now()}-${Math.random()}`;

    const cloneStep = (step: FormStepDto): FormStepDto => ({
        ...step,
        id: undefined, // Remove ID so backend creates new one
        formConfigurationId: undefined,
        sourceStepId: step.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        stepLevelIssues: undefined,
        fields: step.fields.map(f => cloneField(f)),
        conditions: step.conditions.map(c => ({ ...c, id: undefined, formStepId: undefined }))
    });

    const cloneField = (field: FormFieldDto): FormFieldDto => ({
        ...field,
        id: undefined,
        formStepId: undefined,
        sourceFieldId: field.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined,
        validations: field.validations.map(v => ({ ...v, id: undefined, formFieldId: undefined }))
    });

    const handleAddNewStep = () => {
        const newStep: FormStepDto = {
            id: generateTempId(),
            stepName: `Step ${config.steps.length + 1}`,
            title: `Step ${config.steps.length + 1}`,
            description: '',
            order: config.steps.length,
            fieldOrderJson: '[]',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            fields: [],
            conditions: []
        };

        setConfig(prev => ({
            ...prev,
            steps: [...prev.steps, newStep]
        }));
        setSelectedStepIndex(config.steps.length);
    };

    const handleAddReusableStep = async (templateStep: FormStepDto, mode: ReuseLinkMode) => {
        if (!config.id) {
            // If configuration hasn't been saved yet, we can't use the API endpoint
            // Fall back to local cloning
            const clonedStep = cloneStep(templateStep);
            clonedStep.id = generateTempId();
            clonedStep.order = config.steps.length;
            clonedStep.isLinkedToSource = mode === 'link';

            setConfig(prev => ({
                ...prev,
                steps: [...prev.steps, clonedStep]
            }));
            setShowStepSelector(false);
            setSelectedStepIndex(config.steps.length);
            return;
        }

        // Use backend API for saved configurations
        try {
            setAddingTemplate(true);
            setError(null);

            const addedStep = await formConfigClient.addReusableStepToConfiguration(
                config.id,
                {
                    sourceStepId: parseInt(templateStep.id!),
                    linkMode: mode
                }
            );

            // Add the returned step to configuration
            setConfig(prev => ({
                ...prev,
                steps: [...prev.steps, addedStep]
            }));
            setShowStepSelector(false);
            setSelectedStepIndex(config.steps.length);
        } catch (err: any) {
            console.error('Failed to add reusable step:', err);
            const errorMsg = err?.response?.data?.message || err?.message || 'Failed to add step from template';
            setError(errorMsg);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.AddStepFailed');
        } finally {
            setAddingTemplate(false);
        }
    };

    const handleDeleteStep = (index: number) => {
        setConfig(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }))
        }));
        if (selectedStepIndex === index) {
            setSelectedStepIndex(null);
        } else if (selectedStepIndex && selectedStepIndex > index) {
            setSelectedStepIndex(selectedStepIndex - 1);
        }
    };

    const handleStepDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setConfig(prev => {
                const oldIndex = prev.steps.findIndex(s => s.id === active.id);
                const newIndex = prev.steps.findIndex(s => s.id === over.id);

                const reorderedSteps = arrayMove(prev.steps, oldIndex, newIndex).map((s, i) => ({
                    ...s,
                    order: i
                }));

                return { ...prev, steps: reorderedSteps };
            });
        }
    };

    const handleUpdateStep = (updatedStep: FormStepDto) => {
        setConfig(prev => ({
            ...prev,
            steps: prev.steps.map((s, i) =>
                i === selectedStepIndex ? updatedStep : s
            )
        }));
    };

    const validateConfig = (): boolean => {
        if (!config.entityTypeName.trim()) {
            setError('Entity name is required');
            return false;
        }

        if (!config.configurationName.trim()) {
            setError('Configuration name is required');
            return false;
        }

        if (config.steps.length === 0) {
            setError('At least one step is required');
            return false;
        }

        for (const step of config.steps) {
            if (!step.stepName.trim()) {
                setError(`Step ${step.order + 1} must have a name`);
                return false;
            }
        }

        return true;
    };

    const handleRemoveDefault = async (config: FormConfigurationDto) => {
        try {
            // Update the configuration to be default
            const updatedConfig = { ...config, isDefault: false };
            await formConfigClient.update(updatedConfig);
        } catch (error) {
            console.error('Failed to set default configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
        }
    };

    const handleSave = async () => {
        if (!validateConfig()) return;

        try {
            setSaving(true);
            setError(null);

            // Prepare data with ordering arrays
            const configToSave: FormConfigurationDto = {
                ...config,
                stepOrderJson: JSON.stringify(config.steps.map(s => s.id)),
                steps: config.steps.map(step => ({
                    ...step,
                    fieldOrderJson: JSON.stringify(step.fields.map(f => f.id))
                }))
            };

            if (configToSave.isDefault) {
                try {
                    // If setting this config as default, unset others for the same entity
                    const existingDefaults: FormConfigurationDto = await formConfigClient.getByEntityTypeName(config.entityTypeName, true) as FormConfigurationDto;
                    if (existingDefaults && existingDefaults.id && existingDefaults.id !== config.id) {
                        //Show same confirm dialog as the handleSetDefault const in the FormWizardPage.tsx and unset if confirmed
                        if (window.confirm(`There is already a default configuration for "${config.entityTypeName}". Do you want to change the default to "${config.configurationName}"?`)) {
                            await handleRemoveDefault(existingDefaults);
                        } else {
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error checking existing default configuration:', error);
                    logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
                }

            }

            if (isEditMode) {
                await formConfigClient.update(configToSave);
            } else {
                await formConfigClient.create(configToSave);
            }

            const successMessage = isEditMode
                ? 'Configuration updated successfully.'
                : 'Configuration created successfully.';
            setSaveFeedback({
                open: true,
                title: 'Saved',
                message: successMessage,
                status: 'success'
            });
            clearAutoClose();
            autoCloseRef.current = window.setTimeout(() => {
                handleSaveContinue();
            }, 3000);
            if (isEditMode) {
                setHealthRefreshToken(prev => prev + 1);
            }

        } catch (err: any) {
            console.error('Failed to save configuration:', err);
            
            // Extract detailed error message from backend response
            let errorMessage = 'Failed to save configuration';
            let errorTitle = 'Save failed';
            
            if (err?.response?.status === 400) {
                // Backend validation error
                const backendMessage = err.response?.data?.message || err.response?.data?.title;
                if (backendMessage) {
                    errorMessage = backendMessage;
                    errorTitle = 'Validation Error';
                } else {
                    errorMessage = 'The form configuration has validation errors. Please check for compatibility issues with the selected entity type.';
                }
            } else if (err?.response?.status === 404) {
                errorMessage = 'Configuration or template not found. Please try again.';
            } else if (err?.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
            setSaveFeedback({
                open: true,
                title: errorTitle,
                message: errorMessage,
                status: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRulesChanged = () => {
        setHealthRefreshToken(prev => prev + 1);
    };

    // added: helper to check existing default for selected entity
    const checkExistingDefault = async (entityTypeName: string, currentId?: string) => {
        if (!entityTypeName) {
            setDefaultConflictMsg(null);
            return;
        }
        try {
            const existingDefault = await formConfigClient.getByEntityTypeName(entityTypeName, true) as FormConfigurationDto;
            if (existingDefault && existingDefault.id && existingDefault.id !== currentId) {
                setDefaultConflictMsg(
                    `There cannot be more than one default form configuration for "${entityTypeName}". A default already exists: "${existingDefault.configurationName}".`
                );
            } else {
                setDefaultConflictMsg(null);
            }
        } catch {
            // No default exists or endpoint returns 404 → clear message
            setDefaultConflictMsg(null);
        }
    };

    // changed: when entity changes, only check conflict if current config is marked as default
    useEffect(() => {
        if (config.isDefault) {
            checkExistingDefault(config.entityTypeName, config.id);
        } else {
            setDefaultConflictMsg(null);
        }
    }, [config.entityTypeName, config.id, config.isDefault]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Loading Configuration...</h3>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white shadow-sm rounded-lg mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Form Configuration' : 'Create Form Configuration'}
                        </h1>
                        {isEditMode && config.id && (
                            <div className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                                <span>Health issues detected:</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${healthIssueCount > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'}`}>
                                    {healthIssueCount}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* changed: show warning only when isDefault is true and a conflict exists */}
                    {config.isDefault && defaultConflictMsg && (
                        <div className="px-6 pt-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-center">
                                <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-yellow-800">{defaultConflictMsg}</span>
                            </div>
                        </div>
                    )}

                    <div className="px-6 py-4 space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                                <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Entity <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={config.entityTypeName}
                                    onChange={e => setConfig(prev => ({ ...prev, entityTypeName: e.target.value }))}
                                    disabled={isEditMode} // lock entity when editing
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">Select an entity...</option>
                                    {metadata.map(m => (
                                        <option key={m.entityName} value={m.entityName}>
                                            {m.displayName} ({m.entityName})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Configuration Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.configurationName}
                                    onChange={e => setConfig({ ...config, configurationName: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    placeholder="e.g., Default Structure Form"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={config.description || ''}
                                onChange={e => setConfig({ ...config, description: e.target.value })}
                                rows={2}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                placeholder="Optional description of this form configuration"
                            />
                        </div>
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isDefault"
                                checked={config.isDefault}
                                onChange={async e => {
                                    const next = e.target.checked;
                                    setConfig(prev => ({ ...prev, isDefault: next }));
                                    if (next) {
                                        await checkExistingDefault(config.entityTypeName, config.id);
                                    } else {
                                        setDefaultConflictMsg(null);
                                    }
                                }}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">
                                Set as default configuration for this entity
                            </label>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Steps Sidebar */}
                    <div className="col-span-4 bg-white shadow-sm rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium text-gray-900">Steps</h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleAddNewStep}
                                    className="btn-secondary text-xs"
                                    title="Add new step"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setShowStepSelector(true)}
                                    className="btn-secondary text-xs"
                                    title="Add from template"
                                    disabled={addingTemplate}
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {config.steps.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                No steps yet. Click + to add one.
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleStepDragEnd}
                            >
                                <SortableContext
                                    items={config.steps.map(s => s.id!)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {config.steps.map((step, index) => (
                                            <SortableStepItem
                                                key={step.id}
                                                step={step}
                                                index={index}
                                                isSelected={selectedStepIndex === index}
                                                onSelect={() => setSelectedStepIndex(index)}
                                                onDelete={() => handleDeleteStep(index)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    {/* Step Editor */}
                    <div className="col-span-8">
                        {selectedStepIndex !== null && config.steps[selectedStepIndex] ? (
                            <StepEditor
                                step={config.steps[selectedStepIndex]}
                                reusableFields={reusableFields}
                                reusableSteps={reusableSteps}
                                onUpdate={handleUpdateStep}
                                metadataFields={selectedEntityMeta?.fields ?? []}
                                allConfigurationFields={allFieldsInConfiguration}
                                onRulesChanged={handleRulesChanged}
                            />
                        ) : (
                            <div className="bg-white shadow-sm rounded-lg p-12 text-center text-gray-500">
                                Select a step from the sidebar to edit it
                            </div>
                        )}
                    </div>
                </div>

                {/* Configuration Health */}
                <div className="mt-6">
                    <ConfigurationHealthPanel
                        configurationId={config.id}
                        refreshToken={healthRefreshToken}
                        onIssuesLoaded={setHealthIssueCount}
                    />
                </div>

                {/* Save Button */}
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={() => navigate('/admin/form-configurations')}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary"
                    >
                        <Save className="h-5 w-5 mr-2" />
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            <FeedbackModal
                open={saveFeedback.open}
                title={saveFeedback.title}
                message={saveFeedback.message}
                status={saveFeedback.status}
                onClose={closeSaveModal}
                onContinue={handleSaveContinue}
            />

            {showStepSelector && (
                <ReusableStepSelector
                    reusableSteps={reusableSteps}
                    onSelect={handleAddReusableStep}
                    onCancel={() => setShowStepSelector(false)}
                    currentEntityType={config.entityTypeName}
                />
            )}
        </div>
    );
};

