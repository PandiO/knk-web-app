import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, GripVertical, Trash2, AlertCircle, Loader2, Copy } from 'lucide-react';
import { FormConfigurationDto, FormStepDto, FormFieldDto } from '../../utils/domain/dto/forms/FormModels';
import { formConfigClient } from '../../io/formConfigClient';
import { formStepClient } from '../../io/formStepClient';
import { formFieldClient } from '../../io/formFieldClient';
import { logging } from '../../utils';
import { StepEditor } from './StepEditor';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableStepItem } from './SortableStepItem';

export const FormConfigBuilder: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const configId = id || 'new';
    const isEditMode = configId !== 'new';

    const [config, setConfig] = useState<FormConfigurationDto>({
        entityName: '',
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
    const [showReusableSteps, setShowReusableSteps] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        loadData();
    }, [configId]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Always load reusable templates (needed for both create and edit)
            const [stepsData, fieldsData] = await Promise.all([
                formStepClient.getAll(),
                formFieldClient.getAll()
            ]);

            setReusableSteps(stepsData.filter(s => s.isReusable));
            setReusableFields(fieldsData.filter(f => f.isReusable));

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
        fields: step.fields.map(f => cloneField(f)),
        conditions: step.conditions.map(c => ({ ...c, id: undefined, formStepId: undefined }))
    });

    const cloneField = (field: FormFieldDto): FormFieldDto => ({
        ...field,
        id: undefined,
        formStepId: undefined,
        sourceFieldId: field.id,
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
            fields: [],
            conditions: []
        };

        setConfig(prev => ({
            ...prev,
            steps: [...prev.steps, newStep]
        }));
        setSelectedStepIndex(config.steps.length);
    };

    const handleAddReusableStep = (reusableStep: FormStepDto) => {
        const clonedStep = cloneStep(reusableStep);
        clonedStep.id = generateTempId();
        clonedStep.order = config.steps.length;

        setConfig(prev => ({
            ...prev,
            steps: [...prev.steps, clonedStep]
        }));
        setShowReusableSteps(false);
        setSelectedStepIndex(config.steps.length);
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
        if (!config.entityName.trim()) {
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

            if (isEditMode) {
                await formConfigClient.update(configToSave);
            } else {
                await formConfigClient.create(configToSave);
            }

            navigate('/admin/form-configurations');
        } catch (err) {
            console.error('Failed to save configuration:', err);
            setError('Failed to save configuration');
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
        } finally {
            setSaving(false);
        }
    };

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
                {/* Header */}
                <div className="bg-white shadow-sm rounded-lg mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Form Configuration' : 'Create Form Configuration'}
                        </h1>
                    </div>

                    {/* Basic Info */}
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
                                    Entity Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.entityName}
                                    onChange={e => setConfig({ ...config, entityName: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    placeholder="e.g., Structure, User, Order"
                                />
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
                                onChange={e => setConfig({ ...config, isDefault: e.target.checked })}
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
                                    onClick={() => setShowReusableSteps(!showReusableSteps)}
                                    className="btn-secondary text-xs"
                                    title="Add from template"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {showReusableSteps && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-md">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Reusable Steps</h3>
                                <div className="space-y-2">
                                    {reusableSteps.map(step => (
                                        <button
                                            key={step.id}
                                            onClick={() => handleAddReusableStep(step)}
                                            className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50"
                                        >
                                            {step.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                onUpdate={handleUpdateStep}
                            />
                        ) : (
                            <div className="bg-white shadow-sm rounded-lg p-12 text-center text-gray-500">
                                Select a step from the sidebar to edit it
                            </div>
                        )}
                    </div>
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
        </div>
    );
};
