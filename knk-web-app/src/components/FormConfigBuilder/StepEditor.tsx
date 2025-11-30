import React, { useState } from 'react';
import { Plus, Copy, GripVertical, Trash2, Pencil } from 'lucide-react';
import { FormStepDto, FormFieldDto } from '../../utils/domain/dto/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldEditor } from './FieldEditor';
import { FieldMetadataDto } from '../../utils/domain/dto/metadata/MetadataModels';

interface Props {
    step: FormStepDto;
    reusableFields: FormFieldDto[];
    onUpdate: (step: FormStepDto) => void;
    metadataFields?: FieldMetadataDto[]; // added
}

export const StepEditor: React.FC<Props> = ({ step, reusableFields, onUpdate, metadataFields = [] }) => {
    const [editingField, setEditingField] = useState<{ field: FormFieldDto; index: number } | null>(null);
    const [showReusableFields, setShowReusableFields] = useState(false);

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
            validations: []
        };

        setEditingField({ field: newField, index: -1 });
    };

    const handleAddReusableField = (reusableField: FormFieldDto) => {
        const clonedField = cloneField(reusableField);
        clonedField.id = generateTempId();

        onUpdate({
            ...step,
            fields: [...step.fields, clonedField]
        });
        setShowReusableFields(false);
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

                {/* Fields Section */}
                <div className="pt-4 border-t border-gray-200">
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
                                onClick={() => setShowReusableFields(!showReusableFields)}
                                className="btn-secondary text-sm"
                            >
                                <Copy className="h-4 w-4 mr-1" />
                                From Template
                            </button>
                        </div>
                    </div>

                    {showReusableFields && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-md">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Reusable Fields</h4>
                            <div className="space-y-2">
                                {reusableFields.map(field => (
                                    <button
                                        key={field.id}
                                        onClick={() => handleAddReusableField(field)}
                                        className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50 flex justify-between"
                                    >
                                        <span>{field.label}</span>
                                        <span className="text-gray-500">({field.fieldType})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

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
            className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-md"
        >
            <div {...attributes} {...listeners} className="mr-3 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{field.label || field.fieldName || 'Untitled Field'}</div>
                <div className="text-xs text-gray-500">
                    {field.fieldType} {field.isRequired && <span className="text-red-500">*</span>}
                </div>
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
