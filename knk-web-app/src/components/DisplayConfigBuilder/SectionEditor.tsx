import React, { useState, useEffect } from 'react';
import { Plus, Copy, GripVertical, Trash2, Pencil, AlertTriangle, Link as LinkIcon, Copy as CopyIcon } from 'lucide-react';
import { DisplaySectionDto, DisplayFieldDto, ReuseLinkMode } from '../../types/dtos/displayConfig/DisplayModels';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldEditor } from './FieldEditor';
import { ReusableFieldSelector } from './ReusableFieldSelector';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { metadataClient } from '../../apiClients/metadataClient';
import { logging } from '../../utils';
import { FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';

interface Props {
    section: DisplaySectionDto;
    reusableFields: DisplayFieldDto[];
    onUpdate: (section: DisplaySectionDto) => void;
    onAddChildSection?: (parentId: string | number) => void;
    metadataFields?: FieldMetadataDto[]; // All fields of the main entity
}

// Helper: get related entity options from metadataFields
function getRelatedEntityOptions(metadataFields: FieldMetadataDto[]): { propertyName: string; entityTypeName: string; displayLabel: string }[] {
    return metadataFields
        .filter(f => f.isRelatedEntity && f.relatedEntityType)
        .map(f => ({
            propertyName: f.fieldName,
            entityTypeName: f.relatedEntityType!,
            displayLabel: `${f.fieldName} (${f.relatedEntityType})`
        }));
}

export const SectionEditor: React.FC<Props> = ({ section, reusableFields, onUpdate, onAddChildSection, metadataFields = [] }) => {
    const [editingField, setEditingField] = useState<{ field: DisplayFieldDto; index: number } | null>(null);
    const [showFieldSelector, setShowFieldSelector] = useState(false);
    const [addingTemplate, setAddingTemplate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [relatedEntityFields, setRelatedEntityFields] = useState<FieldMetadataDto[]>([]);
    const [loadingRelatedMetadata, setLoadingRelatedMetadata] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const generateTempId = () => `temp-field-${Date.now()}-${Math.random()}`;

    const cloneField = (field: DisplayFieldDto): DisplayFieldDto => ({
        ...field,
        id: undefined,
        displaySectionId: undefined,
        sourceFieldId: field.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined
    });

    const handleAddNewField = () => {
        const newField: DisplayFieldDto = {
            id: generateTempId(),
            fieldGuid: crypto.randomUUID?.() || `guid-${Date.now()}`,
            label: '',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false
        };

        setEditingField({ field: newField, index: -1 });
    };

    const handleAddReusableField = async (templateField: DisplayFieldDto, mode: ReuseLinkMode) => {
        if (!section.id || section.id.startsWith('temp-')) {
            // If section hasn't been saved yet, fall back to local cloning
            const clonedField = cloneField(templateField);
            clonedField.id = generateTempId();
            clonedField.fieldGuid = crypto.randomUUID?.() || `guid-${Date.now()}`;
            clonedField.isLinkedToSource = mode === ReuseLinkMode.Link;

            onUpdate({
                ...section,
                fields: [...section.fields, clonedField]
            });
            setShowFieldSelector(false);
            return;
        }

        // Use backend API for saved sections
        try {
            setAddingTemplate(true);
            setError(null);

            const addedField = await displayConfigClient.addReusableFieldToSection(
                section.id,
                {
                    sourceFieldId: templateField.id!,
                    linkMode: mode
                }
            );

            // Add the returned field to section
            onUpdate({
                ...section,
                fields: [...section.fields, addedField]
            });
            setShowFieldSelector(false);
        } catch (err: any) {
            console.error('Failed to add reusable field:', err);
            const errorMsg = err?.message || 'Failed to add field from template';
            setError(errorMsg);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.AddFieldFailed');
        } finally {
            setAddingTemplate(false);
        }
    };

    const handleSaveField = (field: DisplayFieldDto) => {
        if (editingField!.index === -1) {
            // New field
            onUpdate({
                ...section,
                fields: [...section.fields, field]
            });
        } else {
            // Update existing
            onUpdate({
                ...section,
                fields: section.fields.map((f, i) => i === editingField!.index ? field : f)
            });
        }
        setEditingField(null);
    };

    const handleDeleteField = (index: number) => {
        onUpdate({
            ...section,
            fields: section.fields.filter((_, i) => i !== index)
        });
    };

    const handleFieldDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = section.fields.findIndex(f => f.fieldGuid === active.id || f.id === active.id);
            const newIndex = section.fields.findIndex(f => f.fieldGuid === over.id || f.id === over.id);

            const reorderedFields = arrayMove(section.fields, oldIndex, newIndex);

            onUpdate({ ...section, fields: reorderedFields });
        }
    };

    const parseActionButtons = (json?: string) => {
        if (!json) return {};
        try {
            return JSON.parse(json);
        } catch {
            return {};
        }
    };
    // Related entity options for this section
    const relatedEntityOptions = getRelatedEntityOptions(metadataFields);

    // Load related entity metadata when section.relatedEntityPropertyName changes
    useEffect(() => {
        async function loadRelatedEntityMetadata() {
            if (section.relatedEntityPropertyName && section.relatedEntityTypeName) {
                setLoadingRelatedMetadata(true);
                try {
                    // Assume metadataClient is globally available or imported
                    const metadata = await metadataClient.getEntityMetadata(section.relatedEntityTypeName);
                    setRelatedEntityFields(metadata.fields);
                } catch (err) {
                    setRelatedEntityFields([]);
                } finally {
                    setLoadingRelatedMetadata(false);
                }
            } else {
                setRelatedEntityFields([]);
            }
        }
        loadRelatedEntityMetadata();
    }, [section.relatedEntityPropertyName, section.relatedEntityTypeName]);

    // Handler for changing the dedicated related entity for this section
    const handleRelatedEntityChange = (value: string) => {
        if (!value) {
            // Clear related entity selection
            onUpdate({
                ...section,
                relatedEntityPropertyName: undefined,
                relatedEntityTypeName: undefined
            });
        } else {
            const option = relatedEntityOptions.find(o => o.propertyName === value);
            if (option) {
                onUpdate({
                    ...section,
                    relatedEntityPropertyName: option.propertyName,
                    relatedEntityTypeName: option.entityTypeName
                });
            }
        }
    };

    const actionButtons = parseActionButtons(section.actionButtonsConfigJson);

    const handleActionButtonChange = (key: string, value: boolean) => {
        const updatedButtons = { ...actionButtons, [key]: value };
        onUpdate({
            ...section,
            actionButtonsConfigJson: JSON.stringify(updatedButtons)
        });
    };

    return (
        <div className="bg-white shadow-sm rounded-lg">
            {/* Dedicated to Related Entity selector */}
            {relatedEntityOptions.length > 0 && (
                <div className="px-6 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dedicated to Related Entity
                    </label>
                    <select
                        value={section.relatedEntityPropertyName || ''}
                        onChange={e => handleRelatedEntityChange(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="">None (use main entity)</option>
                        {relatedEntityOptions.map(option => (
                            <option key={option.propertyName} value={option.propertyName}>
                                {option.displayLabel}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                        Select a related entity to dedicate this section to. All fields in this section will be from the related entity.
                    </p>
                </div>
            )}
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Edit Section</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
                {section.hasCompatibilityIssues && section.compatibilityIssues && section.compatibilityIssues.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="flex items-start">
                            <svg className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-red-800 mb-1">Section Compatibility Issues</h4>
                                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                    {section.compatibilityIssues.map((issue, idx) => (
                                        <li key={idx}>{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={section.sectionName}
                        onChange={e => onUpdate({ ...section, sectionName: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        value={section.description || ''}
                        onChange={e => onUpdate({ ...section, description: e.target.value })}
                        rows={2}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="sectionIsReusable"
                            checked={section.isReusable}
                            onChange={e => onUpdate({ ...section, isReusable: e.target.checked })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="sectionIsReusable" className="ml-2 block text-sm text-gray-900">
                            Reusable Template
                        </label>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="sectionIsCollection"
                            checked={section.isCollection}
                            onChange={e => onUpdate({ ...section, isCollection: e.target.checked })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="sectionIsCollection" className="ml-2 block text-sm text-gray-900">
                            Collection (multiple items)
                        </label>
                    </div>
                </div>

                {section.isCollection && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Collection Configuration</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Related Entity Property
                                </label>
                                {relatedEntityOptions.length > 0 ? (
                                    <select
                                        value={section.relatedEntityPropertyName || ''}
                                        onChange={e => {
                                            const value = e.target.value;
                                            if (!value) {
                                                onUpdate({ ...section, relatedEntityPropertyName: undefined, relatedEntityTypeName: undefined });
                                            } else {
                                                const option = relatedEntityOptions.find(o => o.propertyName === value);
                                                if (option) {
                                                    onUpdate({
                                                        ...section,
                                                        relatedEntityPropertyName: option.propertyName,
                                                        relatedEntityTypeName: option.entityTypeName
                                                    });
                                                }
                                            }
                                        }}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    >
                                        <option value="">Select a navigation property...</option>
                                        {relatedEntityOptions.map(option => (
                                            <option key={`collection-prop-${option.propertyName}`} value={option.propertyName}>
                                                {option.propertyName}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={section.relatedEntityPropertyName || ''}
                                        onChange={e => onUpdate({ ...section, relatedEntityPropertyName: e.target.value })}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                        placeholder="e.g., streets, buildings"
                                    />
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    Navigation property for the collection
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Related Entity Type
                                </label>
                                <input
                                    type="text"
                                    value={section.relatedEntityTypeName || ''}
                                    readOnly
                                    className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-600 sm:text-sm"
                                    placeholder="Auto-filled from selected property"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Auto-populated when you select a Related Entity Property
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                className="btn-secondary text-sm"
                                onClick={() => onAddChildSection && onAddChildSection(section.sectionGuid || section.id!)}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add item template section
                            </button>
                        </div>
                    </div>
                )}

                {section.sourceSectionId && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span>
                            {section.isLinkedToSource ? 'Linked to template' : 'Copied from template'} (source ID: {section.sourceSectionId})
                        </span>
                    </div>
                )}

                {/* Action Buttons Configuration */}
                <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Action Buttons</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showViewButton || false}
                                onChange={e => handleActionButtonChange('showViewButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">View</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showEditButton || false}
                                onChange={e => handleActionButtonChange('showEditButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Edit</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showCreateButton || false}
                                onChange={e => handleActionButtonChange('showCreateButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Create</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showSelectButton || false}
                                onChange={e => handleActionButtonChange('showSelectButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Select</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showAddButton || false}
                                onChange={e => handleActionButtonChange('showAddButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Add</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showRemoveButton || false}
                                onChange={e => handleActionButtonChange('showRemoveButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Remove</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={actionButtons.showUnlinkButton || false}
                                onChange={e => handleActionButtonChange('showUnlinkButton', e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Unlink</span>
                        </label>
                    </div>
                </div>

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

                    {section.fields.length === 0 ? (
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
                                items={section.fields.map(f => f.fieldGuid || f.id!)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {section.fields.map((field, index) => (
                                        <SortableFieldItem
                                            key={field.fieldGuid || field.id}
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
                    metadataFields={section.relatedEntityPropertyName ? relatedEntityFields : metadataFields}
                    sectionDedicatedToEntity={section.relatedEntityPropertyName ? { propertyName: section.relatedEntityPropertyName, entityTypeName: section.relatedEntityTypeName! } : undefined}
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
    field: DisplayFieldDto;
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
    } = useSortable({ id: field.fieldGuid || field.id! });

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
                        />
                    )}
                    {field.isReusable && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            Template
                        </span>
                    )}
                    {field.sourceFieldId && (
                        field.isLinkedToSource ? (
                            <LinkIcon className="h-3 w-3 text-blue-600 flex-shrink-0" />
                        ) : (
                            <CopyIcon className="h-3 w-3 text-gray-600 flex-shrink-0" />
                        )
                    )}
                </div>
                <div className="text-xs text-gray-500">
                    {field.fieldType && <span>{field.fieldType} | </span>}
                    {field.fieldName || 'Template only'}
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

