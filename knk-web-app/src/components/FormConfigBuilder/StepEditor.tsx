import React, { useState } from 'react';
import { Plus, Copy, GripVertical, Trash2, Pencil, AlertTriangle, Link as LinkIcon, Copy as CopyIcon } from 'lucide-react';
import { FormStepDto, FormFieldDto, ReuseLinkMode } from '../../utils/domain/dto/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldEditor } from './FieldEditor';
import { FieldMetadataDto } from '../../utils/domain/dto/metadata/MetadataModels';
import { ReusableFieldSelector } from './ReusableFieldSelector';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { logging } from '../../utils';

interface Props {
    step: FormStepDto;
    reusableFields: FormFieldDto[];
    onUpdate: (step: FormStepDto) => void;
    metadataFields?: FieldMetadataDto[]; // added
}

export const StepEditor: React.FC<Props> = ({ step, reusableFields, onUpdate, metadataFields = [] }) => {
    const [editingField, setEditingField] = useState<{ field: FormFieldDto; index: number } | null>(null);
    const [showFieldSelector, setShowFieldSelector] = useState(false);
    const [addingTemplate, setAddingTemplate] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
        } catch (err: any) {
            console.error('Failed to add reusable field:', err);
            const errorMsg = err?.response?.data?.message || err?.message || 'Failed to add field from template';
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

                    {step.fields.length === 0 ? (
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
                                items={step.fields.map(f => f.id!)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {step.fields.map((field, index) => (
                                        <SortableFieldItem
                                            key={field.id}
                                            field={field}
                                            onEdit={() => setEditingField({ field, index })}
                                            onDelete={() => handleDeleteField(index)}
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
                />
            )}

            {showFieldSelector && (
                <ReusableFieldSelector
                    reusableFields={reusableFields}
                    onSelect={handleAddReusableField}
                    onCancel={() => setShowFieldSelector(false)}
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
                            title={field.compatibilityIssues?.join('; ') || 'Has compatibility issues'} 
                        />
                    )}
                    {field.isReusable && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            Template
                        </span>
                    )}
                    {field.sourceFieldId && (
                        field.isLinkedToSource ? (
                            <LinkIcon className="h-3 w-3 text-blue-600 flex-shrink-0" title="Linked to template" />
                        ) : (
                            <CopyIcon className="h-3 w-3 text-gray-600 flex-shrink-0" title="Copied from template" />
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
