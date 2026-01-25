import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Copy, GripVertical, Trash2, Pencil, AlertTriangle, Link as LinkIcon, Copy as CopyIcon } from 'lucide-react';
import { FormStepDto, FormFieldDto, ReuseLinkMode } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldEditor } from './FieldEditor';
import { FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { ReusableFieldSelector } from './ReusableFieldSelector';
import { ReusableStepSelector } from './ReusableStepSelector';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { metadataClient } from '../../apiClients/metadataClient';
import { logging } from '../../utils';

interface Props {
    step: FormStepDto;
    reusableFields: FormFieldDto[];
    reusableSteps: FormStepDto[];
    onUpdate: (step: FormStepDto) => void;
    metadataFields?: FieldMetadataDto[]; // added
    allConfigurationFields?: FormFieldDto[];
    onRulesChanged?: () => void;
}

export const StepEditor: React.FC<Props> = ({
    step,
    reusableFields,
    reusableSteps,
    onUpdate,
    metadataFields = [],
    allConfigurationFields,
    onRulesChanged
}) => {
    const [editingField, setEditingField] = useState<{ field: FormFieldDto; index: number } | null>(null);
    const [showFieldSelector, setShowFieldSelector] = useState(false);
    const [addingTemplate, setAddingTemplate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableEntityTypes, setAvailableEntityTypes] = useState<string[]>([]);
    const [showChildStepSelector, setShowChildStepSelector] = useState(false);
    const [childFieldEdit, setChildFieldEdit] = useState<{ childIndex: number; field: FormFieldDto; index: number } | null>(null);
    const [childFieldSelectorIndex, setChildFieldSelectorIndex] = useState<number | null>(null);
    const [joinEntityFields, setJoinEntityFields] = useState<FieldMetadataDto[]>([]);
    const [loadingJoinEntityFields, setLoadingJoinEntityFields] = useState(false);

    // Load available entity types for join entity dropdown
    useEffect(() => {
        const loadEntityTypes = async () => {
            try {
                const metadata = await metadataClient.getAllEntityMetadata();
                const entityNames = metadata.map(m => m.entityName).sort();
                setAvailableEntityTypes(entityNames);
            } catch (err) {
                console.error('Failed to load entity types:', err);
            }
        };
        loadEntityTypes();
    }, []);

    // Filter related entity navigation properties from metadata for dropdown
    // Heuristic: treat collection-like types as many-to-many candidates to avoid one-to-one/one-to-many scalar refs (e.g., IconMaterialRef).
    const navigationProperties = useMemo(() => {
        const isCollectionType = (fieldType?: string) => {
            if (!fieldType) return false;
            const normalized = fieldType.toLowerCase();
            return (
                normalized.includes('list') ||
                normalized.includes('icollection') ||
                normalized.includes('ienumerable') ||
                normalized.includes('collection') ||
                normalized.includes('hashset') ||
                normalized.endsWith('[]')
            );
        };

        return (metadataFields || [])
            .filter(f => f.isRelatedEntity && isCollectionType(f.fieldType))
            .map(f => f.fieldName)
            .sort();
    }, [metadataFields]);

    // Load join entity metadata for child step field guidance
    useEffect(() => {
        const loadJoinEntityMeta = async () => {
            if (!step.joinEntityType) {
                setJoinEntityFields([]);
                return;
            }
            setLoadingJoinEntityFields(true);
            try {
                const metadata = await metadataClient.getEntityMetadata(step.joinEntityType);
                setJoinEntityFields(metadata.fields || []);
            } catch (err) {
                console.error('Failed to load join entity metadata:', err);
                setJoinEntityFields([]);
            } finally {
                setLoadingJoinEntityFields(false);
            }
        };

        loadJoinEntityMeta();
    }, [step.joinEntityType]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Reorder fields based on fieldOrderJson for correct display
    const orderedFields = useMemo(() => {
        if (!step.fieldOrderJson) {
            return step.fields;
        }

        try {
            const orderArray = JSON.parse(step.fieldOrderJson);
            if (!Array.isArray(orderArray) || orderArray.length === 0) {
                return step.fields;
            }

            // Create a map of fieldGuid -> field
            const fieldMap = new Map<string, FormFieldDto>();
            step.fields.forEach(f => {
                if (f.fieldGuid) {
                    fieldMap.set(f.fieldGuid, f);
                }
            });

            // Reorder fields based on the GUID order in fieldOrderJson
            const reordered: FormFieldDto[] = [];
            orderArray.forEach((guid: string) => {
                const field = fieldMap.get(guid);
                if (field) {
                    reordered.push(field);
                }
            });

            // Add any fields that weren't in the order array (shouldn't happen, but be safe)
            step.fields.forEach(f => {
                if (!reordered.includes(f)) {
                    reordered.push(f);
                }
            });

            return reordered;
        } catch {
            // If parsing fails, return fields as-is
            return step.fields;
        }
    }, [step.fields, step.fieldOrderJson]);

    // Helper function to get ordered fields for a child step
    const getOrderedChildFields = (childStep: FormStepDto): FormFieldDto[] => {
        if (!childStep.fieldOrderJson) {
            return childStep.fields;
        }

        try {
            const orderArray = JSON.parse(childStep.fieldOrderJson);
            if (!Array.isArray(orderArray) || orderArray.length === 0) {
                return childStep.fields;
            }

            const fieldMap = new Map<string, FormFieldDto>();
            childStep.fields.forEach(f => {
                if (f.fieldGuid) {
                    fieldMap.set(f.fieldGuid, f);
                }
            });

            const reordered: FormFieldDto[] = [];
            orderArray.forEach((guid: string) => {
                const field = fieldMap.get(guid);
                if (field) {
                    reordered.push(field);
                }
            });

            childStep.fields.forEach(f => {
                if (!reordered.includes(f)) {
                    reordered.push(f);
                }
            });

            return reordered;
        } catch {
            return childStep.fields;
        }
    };

    const generateTempId = () => `temp-field-${Date.now()}-${Math.random()}`;

    const cloneField = (field: FormFieldDto): FormFieldDto => ({
        ...field,
        id: undefined,
        formStepId: undefined,
        sourceFieldId: field.id,
        order: step.fields.length,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined,
        validations: field.validations.map(v => ({ ...v, id: undefined, formFieldId: undefined }))
    });

    const handleAddNewField = () => {
        const newField: FormFieldDto = {
            id: generateTempId(),
            fieldName: '',
            label: '',
            fieldType: FieldType.String,
            isRequired: false,
            isReadOnly: false,
            order: step.fields.length,
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            validations: []
        };

        setEditingField({ field: newField, index: -1 });
    };

    const updateChildStepAt = (childIndex: number, updater: (child: FormStepDto) => FormStepDto) => {
        const updatedChildSteps = (step.childFormSteps || []).map((child, idx) => (idx === childIndex ? updater(child) : child));
        onUpdate({ ...step, childFormSteps: updatedChildSteps });
    };

    const handleAddNewChildStep = () => {
        const newChild: FormStepDto = {
            id: generateTempId(),
            stepName: `Child Step ${(step.childFormSteps?.length || 0) + 1}`,
            title: `Child Step ${(step.childFormSteps?.length || 0) + 1}`,
            description: '',
            order: step.childFormSteps?.length || 0,
            fieldOrderJson: '[]',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isManyToManyRelationship: false,
            childFormSteps: [],
            fields: [],
            conditions: [],
            parentStepId: step.id
        };

        onUpdate({ ...step, childFormSteps: [...(step.childFormSteps || []), newChild] });
    };

    const cloneChildStep = (template: FormStepDto, mode: ReuseLinkMode): FormStepDto => ({
        ...template,
        id: generateTempId(),
        formConfigurationId: undefined,
        parentStepId: step.id,
        sourceStepId: template.id,
        isLinkedToSource: mode === 'link',
        hasCompatibilityIssues: false,
        stepLevelIssues: undefined,
        isManyToManyRelationship: false,
        childFormSteps: [],
        fields: template.fields.map(f => ({
            ...f,
            id: generateTempId(),
            formStepId: undefined,
            sourceFieldId: f.id,
            isLinkedToSource: mode === 'link',
            hasCompatibilityIssues: false,
            compatibilityIssues: undefined,
            order: f.order,
            validations: f.validations.map(v => ({ ...v, id: undefined, formFieldId: undefined }))
        })),
        conditions: template.conditions.map(c => ({ ...c, id: undefined, formStepId: undefined }))
    });

    const handleAddChildStepFromTemplate = (template: FormStepDto, mode: ReuseLinkMode) => {
        const cloned = cloneChildStep(template, mode);
        onUpdate({ ...step, childFormSteps: [...(step.childFormSteps || []), cloned] });
        setShowChildStepSelector(false);
    };

    const handleDeleteChildStep = (childIndex: number) => {
        const remaining = (step.childFormSteps || []).filter((_, idx) => idx !== childIndex).map((child, idx) => ({ ...child, order: idx }));
        onUpdate({ ...step, childFormSteps: remaining });
    };

    const handleUpdateChildMeta = (childIndex: number, patch: Partial<FormStepDto>) => {
        updateChildStepAt(childIndex, child => ({ ...child, ...patch }));
    };

    const handleAddChildField = (childIndex: number) => {
        const child = (step.childFormSteps || [])[childIndex];
        const newField: FormFieldDto = {
            id: generateTempId(),
            fieldName: '',
            label: '',
            fieldType: FieldType.String,
            isRequired: false,
            isReadOnly: false,
            order: child.fields.length,
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            validations: []
        };

        const updatedChild = { ...child, fields: [...child.fields, newField] };
        updateChildStepAt(childIndex, () => updatedChild);
        setChildFieldEdit({ childIndex, field: newField, index: child.fields.length });
    };

    const cloneChildField = (field: FormFieldDto, order: number, mode: ReuseLinkMode): FormFieldDto => ({
        ...field,
        id: generateTempId(),
        formStepId: undefined,
        sourceFieldId: field.id,
        isLinkedToSource: mode === 'link',
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined,
        order,
        validations: field.validations.map(v => ({ ...v, id: undefined, formFieldId: undefined }))
    });

    const handleAddChildReusableField = (childIndex: number, templateField: FormFieldDto, mode: ReuseLinkMode) => {
        const child = (step.childFormSteps || [])[childIndex];
        const cloned = cloneChildField(templateField, child.fields.length, mode);
        updateChildStepAt(childIndex, c => ({ ...c, fields: [...c.fields, cloned] }));
    };

    const handleSaveChildField = (childIndex: number, field: FormFieldDto) => {
        updateChildStepAt(childIndex, child => {
            const idx = child.fields.findIndex(f => f.id === field.id);
            const fields = idx === -1
                ? [...child.fields, { ...field, order: child.fields.length }]
                : child.fields.map((f, i) => (i === idx ? field : f));
            return { ...child, fields };
        });
        setChildFieldEdit(null);
    };

    const handleDeleteChildField = (childIndex: number, fieldIndex: number) => {
        updateChildStepAt(childIndex, child => ({
            ...child,
            fields: child.fields.filter((_, i) => i !== fieldIndex).map((f, i) => ({ ...f, order: i }))
        }));
    };

    const handleChildFieldDragEnd = (childIndex: number, event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const child = (step.childFormSteps || [])[childIndex];
        const oldIndex = child.fields.findIndex(f => f.id === active.id);
        const newIndex = child.fields.findIndex(f => f.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(child.fields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
        updateChildStepAt(childIndex, c => ({ ...c, fields: reordered }));
    };

    const handleAddReusableField = async (templateField: FormFieldDto, mode: ReuseLinkMode) => {
        if (!step.id || step.id.startsWith('temp-')) {
            // If step hasn't been saved yet, fall back to local cloning
            const clonedField = cloneField(templateField);
            clonedField.id = generateTempId();
            clonedField.isLinkedToSource = mode === 'link';

            onUpdate({
                ...step,
                fields: [...step.fields, clonedField]
            });
            setShowFieldSelector(false);
            return;
        }

        // Use backend API for saved steps
        try {
            setAddingTemplate(true);
            setError(null);

            const addedField = await formConfigClient.addReusableFieldToStep(
                step.id,
                {
                    sourceFieldId: parseInt(templateField.id!),
                    linkMode: mode
                }
            );

            // Add the returned field to step
            onUpdate({
                ...step,
                fields: [...step.fields, addedField]
            });
            setShowFieldSelector(false);
        } catch (err) {
            console.error('Failed to add reusable field:', err);
            let errorMsg = 'Failed to add field from template';
            if (err && typeof err === 'object') {
                const maybeErr = err as { message?: string; response?: { data?: { message?: string } } };
                errorMsg = maybeErr.response?.data?.message ?? maybeErr.message ?? errorMsg;
            }
            setError(errorMsg);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.AddFieldFailed');
        } finally {
            setAddingTemplate(false);
        }
    };

    const handleSaveField = (field: FormFieldDto) => {
        if (editingField!.index === -1) {
            // New field
            onUpdate({
                ...step,
                fields: [...step.fields, { ...field, order: step.fields.length }]
            });
        } else {
            // Update existing
            onUpdate({
                ...step,
                fields: step.fields.map((f, i) => i === editingField!.index ? field : f)
            });
        }
        setEditingField(null);
    };

    const handleDeleteField = (index: number) => {
        onUpdate({
            ...step,
            fields: step.fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i }))
        });
    };

    const handleFieldDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = step.fields.findIndex(f => f.id === active.id);
            const newIndex = step.fields.findIndex(f => f.id === over.id);

            const reorderedFields = arrayMove(step.fields, oldIndex, newIndex).map((f, i) => ({
                ...f,
                order: i
            }));

            onUpdate({ ...step, fields: reorderedFields });
        }
    };

    return (
        <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Edit Step</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
                {step.hasCompatibilityIssues && step.stepLevelIssues && step.stepLevelIssues.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="flex items-start">
                            <svg className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-red-800 mb-1">Step Compatibility Issues</h4>
                                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                    {step.stepLevelIssues.map((issue, idx) => (
                                        <li key={idx}>{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Step Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={step.stepName}
                        onChange={e => onUpdate({ ...step, stepName: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={step.title}
                        onChange={e => onUpdate({ ...step, title: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        value={step.description || ''}
                        onChange={e => onUpdate({ ...step, description: e.target.value })}
                        rows={2}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                </div>

                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="stepIsReusable"
                        checked={step.isReusable}
                        onChange={e => onUpdate({ ...step, isReusable: e.target.checked })}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="stepIsReusable" className="ml-2 block text-sm text-gray-900">
                        Mark this step as a reusable template
                    </label>
                </div>

                {/* Many-to-Many Relationship Configuration */}
                <div className="border-t border-gray-200 pt-4 space-y-4">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="stepIsManyToMany"
                            checked={step.isManyToManyRelationship}
                            onChange={e => onUpdate({ 
                                ...step, 
                                isManyToManyRelationship: e.target.checked,
                                // Clear M2M fields if unchecked
                                relatedEntityPropertyName: e.target.checked ? step.relatedEntityPropertyName : undefined,
                                joinEntityType: e.target.checked ? step.joinEntityType : undefined,
                                childFormSteps: e.target.checked ? (step.childFormSteps ?? []) : []
                            })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="stepIsManyToMany" className="ml-2 block text-sm font-medium text-gray-900">
                            This step manages a many-to-many relationship
                        </label>
                    </div>

                    {step.isManyToManyRelationship && (
                        <div className="ml-6 space-y-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                            <div className="text-sm text-blue-800 mb-3">
                                <p className="font-medium mb-1">Many-to-Many Relationship Configuration</p>
                                <p className="text-xs">
                                    This step will display a PagedEntityTable for selecting related entities and cards for editing relationship instances with join entity fields.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Related Entity Property Name <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={step.relatedEntityPropertyName || ''}
                                    onChange={e => onUpdate({ ...step, relatedEntityPropertyName: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">-- Select navigation property --</option>
                                    {navigationProperties.map(prop => (
                                        <option key={prop} value={prop}>
                                            {prop}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    The navigation property on the parent entity that holds the related entity collection
                                </p>
                                {navigationProperties.length === 0 && (
                                    <p className="mt-1 text-xs text-yellow-600">
                                        ⚠️ No related entity navigation properties found. Make sure you've selected an entity type for this form configuration.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Join Entity Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={step.joinEntityType || ''}
                                    onChange={e => onUpdate({ ...step, joinEntityType: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">-- Select join entity type --</option>
                                    {availableEntityTypes.map(entityType => (
                                        <option key={entityType} value={entityType}>
                                            {entityType}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    The entity type that holds the many-to-many relationship with extra fields (e.g., Level, Priority)
                                </p>
                                {loadingJoinEntityFields && (
                                    <p className="mt-1 text-xs text-blue-700">Loading join entity metadata…</p>
                                )}
                            </div>

                            <div className="bg-white border border-blue-300 rounded-md p-3 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Join Entity Fields Template (Child Steps)</h4>
                                        <p className="text-xs text-gray-600">
                                            Add child steps that act like item templates (similar to Display Config collections). Their fields render on the join entity cards.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className="btn-secondary text-xs"
                                            onClick={handleAddNewChildStep}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add child step
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary text-xs"
                                            onClick={() => setShowChildStepSelector(true)}
                                            disabled={reusableSteps.length === 0}
                                        >
                                            <Copy className="h-4 w-4 mr-1" />
                                            From template
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                                    <p className="text-xs text-yellow-800">
                                        These child steps mirror the Display Config collection flow. Configure fields here to shape the join entity cards.
                                    </p>
                                </div>

                                {(step.childFormSteps ?? []).length > 0 ? (
                                    <div className="space-y-3">
                                        {(step.childFormSteps ?? []).map((childStep, childIdx) => (
                                            <div key={childStep.id || childIdx} className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">{childStep.stepName || `Child Step ${childIdx + 1}`}</div>
                                                        <div className="text-xs text-gray-500">{childStep.title || 'Join entity card template'}</div>
                                                        <div className="text-xs text-gray-500 mt-1">{childStep.fields.length} field{childStep.fields.length === 1 ? '' : 's'}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary text-xs"
                                                            onClick={() => handleAddChildField(childIdx)}
                                                        >
                                                            <Plus className="h-4 w-4 mr-1" />
                                                            Add field
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-secondary text-xs"
                                                            onClick={() => setChildFieldSelectorIndex(childIdx)}
                                                            disabled={addingTemplate}
                                                        >
                                                            <Copy className="h-4 w-4 mr-1" />
                                                            From template
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="p-1 text-gray-400 hover:text-red-600"
                                                            onClick={() => handleDeleteChildStep(childIdx)}
                                                            title="Remove child step"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Step Name</label>
                                                        <input
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                            value={childStep.stepName}
                                                            onChange={e => handleUpdateChildMeta(childIdx, { stepName: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                                                        <input
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                            value={childStep.title}
                                                            onChange={e => handleUpdateChildMeta(childIdx, { title: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="border-t border-dashed border-gray-200 pt-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h5 className="text-sm font-medium text-gray-900">Child Fields</h5>
                                                        <span className="text-xs text-gray-500">Drag to reorder</span>
                                                    </div>
                                                    {childStep.fields.length === 0 ? (
                                                        <div className="text-center py-4 text-gray-500 text-xs border border-dashed border-gray-300 rounded-md">
                                                            No fields yet. Add a field to define the join entity card.
                                                        </div>
                                                    ) : (
                                                        <DndContext
                                                            sensors={sensors}
                                                            collisionDetection={closestCenter}
                                                            onDragEnd={event => handleChildFieldDragEnd(childIdx, event)}
                                                        >
                                                            <SortableContext
                                                                items={getOrderedChildFields(childStep).map(f => f.id!)}
                                                                strategy={verticalListSortingStrategy}
                                                            >
                                                                <div className="space-y-2">
                                                                    {getOrderedChildFields(childStep).map((field, displayIndex) => {
                                                                        const actualIndex = childStep.fields.findIndex(f => f.id === field.id);
                                                                        return (
                                                                            <SortableFieldItem
                                                                                key={field.id}
                                                                                field={field}
                                                                                onEdit={() => setChildFieldEdit({ childIndex: childIdx, field, index: actualIndex })}
                                                                                onDelete={() => handleDeleteChildField(childIdx, actualIndex)}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            </SortableContext>
                                                        </DndContext>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">
                                        No child steps configured yet. Add one to capture join entity fields (e.g., Level, Priority).
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {step.sourceStepId && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span>
                            {step.isLinkedToSource ? 'Linked to template' : 'Copied from template'} (source ID: {step.sourceStepId})
                        </span>
                    </div>
                )}

                {/* Fields Section */}
                <div className="pt-4 border-t border-gray-200">
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                            <svg className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-md font-medium text-gray-900">Fields</h3>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleAddNewField}
                                className="btn-secondary text-sm"
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Field
                            </button>
                            <button
                                onClick={() => setShowFieldSelector(true)}
                                className="btn-secondary text-sm"
                                disabled={addingTemplate}
                            >
                                <Copy className="h-4 w-4 mr-1" />
                                From Template
                            </button>
                        </div>
                    </div>

                    {orderedFields.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-300 rounded-md">
                            No fields yet. Click "Add Field" to create one.
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleFieldDragEnd}
                        >
                            <SortableContext
                                items={orderedFields.map(f => f.id!)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {orderedFields.map((field, index) => (
                                        <SortableFieldItem
                                            key={field.id}
                                            field={field}
                                            onEdit={() => {
                                                // Find the actual index in step.fields for editing
                                                const actualIndex = step.fields.findIndex(f => f.id === field.id);
                                                setEditingField({ field, index: actualIndex });
                                            }}
                                            onDelete={() => {
                                                const actualIndex = step.fields.findIndex(f => f.id === field.id);
                                                handleDeleteField(actualIndex);
                                            }}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Field Editor Modal */}
            {editingField && (
                <FieldEditor
                    field={editingField.field}
                    onSave={handleSaveField}
                    onCancel={() => setEditingField(null)}
                    metadataFields={metadataFields} // added
                    allFields={allConfigurationFields || step.fields}
                    onRulesChanged={onRulesChanged}
                />
            )}

            {childFieldEdit && (
                <FieldEditor
                    field={childFieldEdit.field}
                    onSave={field => handleSaveChildField(childFieldEdit.childIndex, field)}
                    onCancel={() => setChildFieldEdit(null)}
                    metadataFields={joinEntityFields.length > 0 ? joinEntityFields : metadataFields}
                    allFields={allConfigurationFields || step.fields}
                    onRulesChanged={onRulesChanged}
                />
            )}

            {showFieldSelector && (
                <ReusableFieldSelector
                    reusableFields={reusableFields}
                    onSelect={handleAddReusableField}
                    onCancel={() => setShowFieldSelector(false)}
                />
            )}

            {childFieldSelectorIndex !== null && (
                <ReusableFieldSelector
                    reusableFields={reusableFields}
                    onSelect={(templateField, mode) => {
                        handleAddChildReusableField(childFieldSelectorIndex, templateField, mode);
                        setChildFieldSelectorIndex(null);
                    }}
                    onCancel={() => setChildFieldSelectorIndex(null)}
                />
            )}

            {showChildStepSelector && (
                <ReusableStepSelector
                    reusableSteps={reusableSteps}
                    onSelect={(template, mode) => handleAddChildStepFromTemplate(template, mode)}
                    onCancel={() => setShowChildStepSelector(false)}
                />
            )}
        </div>
    );
};

interface SortableFieldItemProps {
    field: FormFieldDto;
    onEdit: () => void;
    onDelete: () => void;
}

const SortableFieldItem: React.FC<SortableFieldItemProps> = ({ field, onEdit, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: field.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center p-3 border rounded-md ${
                field.hasCompatibilityIssues 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-gray-50 border-gray-200'
            }`}
        >
            <div {...attributes} {...listeners} className="mr-3 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">{field.label || field.fieldName || 'Untitled Field'}</div>
                    {field.hasCompatibilityIssues && (
                        <AlertTriangle 
                            className="h-4 w-4 text-red-600 flex-shrink-0 cursor-help" 
                            aria-label={field.compatibilityIssues?.join('; ') || 'Has compatibility issues'} 
                        />
                    )}
                    {field.isReusable && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            Template
                        </span>
                    )}
                    {field.sourceFieldId && (
                        field.isLinkedToSource ? (
                            <LinkIcon className="h-3 w-3 text-blue-600 flex-shrink-0" aria-label="Linked to template" />
                        ) : (
                            <CopyIcon className="h-3 w-3 text-gray-600 flex-shrink-0" aria-label="Copied from template" />
                        )
                    )}
                </div>
                <div className="text-xs text-gray-500">
                    {field.fieldType} {field.isRequired && <span className="text-red-500">*</span>}
                </div>
                {field.hasCompatibilityIssues && field.compatibilityIssues && field.compatibilityIssues.length > 0 && (
                    <div className="mt-1 text-xs text-red-700">
                        {field.compatibilityIssues.join('; ')}
                    </div>
                )}
            </div>
            <div className="flex space-x-2">
                <button
                    onClick={onEdit}
                    className="p-1 text-gray-400 hover:text-gray-600"
                >
                    <Pencil className="h-4 w-4" />
                </button>
                <button
                    onClick={onDelete}
                    className="p-1 text-gray-400 hover:text-red-600"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

