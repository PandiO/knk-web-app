import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { FieldMetadataDto, EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { metadataClient } from '../../apiClients/metadataClient';
import { mapFieldType } from '../../utils/fieldTypeMapper';

interface Props {
    field: FormFieldDto;
    onSave: (field: FormFieldDto) => void;
    onCancel: () => void;
    metadataFields?: FieldMetadataDto[];
}

export const FieldEditor: React.FC<Props> = ({ field: initialField, onSave, onCancel, metadataFields = [] }) => {
    const [field, setField] = useState<FormFieldDto>(initialField);
    const [collectionElementType, setCollectionElementType] = useState<FieldType>(
        initialField.elementType || FieldType.String
    );
    const [entityMetadata, setEntityMetadata] = useState<EntityMetadataDto[]>([]);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const data = await metadataClient.getAllEntityMetadata();
                setEntityMetadata(data);
            } catch (error) {
                console.error('Failed to load entity metadata:', error);
            }
        };
        loadMetadata();
    }, []);

    const isCollectionType = (type: FieldType): boolean => {
        return type === FieldType.List;
    };

    const handleFieldNameChange = (selectedFieldName: string) => {
        const metaField = metadataFields.find(mf => mf.fieldName === selectedFieldName);
        if (metaField) {
            setField(prev => ({
                ...prev,
                fieldName: metaField.fieldName,
                label: metaField.fieldName, // auto-populate label
                fieldType: mapFieldType(metaField.fieldType), // auto-populate type
                // optionally set objectType if it's a related entity
                objectType: metaField.isRelatedEntity ? metaField.relatedEntityType || undefined : undefined
            }));
        } else {
            setField(prev => ({ ...prev, fieldName: selectedFieldName }));
        }
    };

    const handleSave = () => {
        if (!field.fieldName.trim() || !field.label.trim()) {
            alert('Field name and label are required');
            return;
        }
        if (!field.fieldType) {
            alert('Field type is required');
            return;
        }
        if (isCollectionType(field.fieldType) && !collectionElementType) {
            alert('Element type is required for collection fields');
            return;
        }
        if ((field.fieldType === FieldType.Object || 
            (isCollectionType(field.fieldType) && collectionElementType === FieldType.Object)) &&
            !field.objectType?.trim()) {
            alert('Object type is required for Object fields');
            return;
        }

        const fieldToSave: FormFieldDto = {
            ...field,
            elementType: isCollectionType(field.fieldType) ? collectionElementType : undefined
        };
        onSave(fieldToSave);
    };

    const handleFieldTypeChange = (newType: FieldType) => {
        setField({ ...field, fieldType: newType });
        if (isCollectionType(newType)) {
            setCollectionElementType(FieldType.String);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                        {field.id ? 'Edit Field' : 'New Field'}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Field Name <span className="text-red-500">*</span>
                            </label>
                            {metadataFields.length > 0 ? (
                                <select
                                    value={field.fieldName}
                                    onChange={e => handleFieldNameChange(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">Select a field...</option>
                                    {metadataFields.map(mf => (
                                        <option key={mf.fieldName} value={mf.fieldName}>
                                            {mf.fieldName} ({mf.fieldType})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={field.fieldName}
                                    onChange={e => setField({ ...field, fieldName: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    placeholder="e.g., streetName, totalCost"
                                />
                            )}
                            {metadataFields.length > 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                    Select from entity fields or leave empty to add custom field
                                </p>
                            )}
                            
                            {/* added: Show metadata hints for selected field */}
                            {field.fieldName && metadataFields.length > 0 && (
                                <FieldMetadataHint fieldName={field.fieldName} metadataFields={metadataFields} />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Label <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={field.label}
                                onChange={e => setField({ ...field, label: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                placeholder="e.g., Street Name, Total Cost"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={field.fieldType}
                            onChange={e => handleFieldTypeChange(e.target.value as FieldType)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            required
                        >
                            {Object.values(FieldType).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {isCollectionType(field.fieldType) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Element Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={collectionElementType}
                                onChange={e => setCollectionElementType(e.target.value as FieldType)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                required
                            >
                                {Object.values(FieldType).filter(t => t !== FieldType.List).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                Specify the type of elements this {field.fieldType.toLowerCase()} will contain
                            </p>
                        </div>
                    )}

                    {(field.fieldType === FieldType.Object || 
                      (isCollectionType(field.fieldType) && collectionElementType === FieldType.Object)) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Object Type <span className="text-red-500">*</span>
                                {isCollectionType(field.fieldType) && <span className="text-xs text-gray-500 font-normal ml-1">(for List elements)</span>}
                            </label>
                            <select
                                value={field.objectType || ''}
                                onChange={e => setField({ ...field, objectType: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                required
                            >
                                <option value="">Select an entity...</option>
                                {entityMetadata.map(m => (
                                    <option key={m.entityName} value={m.entityName}>
                                        {m.displayName} ({m.entityName})
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                {isCollectionType(field.fieldType) 
                                    ? 'The type of objects this list will contain'
                                    : 'The type of this object field'}
                            </p>
                        </div>
                    )}

                    {isCollectionType(field.fieldType) && collectionElementType === FieldType.Object && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Minimum Selection
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={field.minSelection ?? 0}
                                        onChange={e => setField({ ...field, minSelection: parseInt(e.target.value) || 0 })}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Minimum number of items user must select (0 = no minimum)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Maximum Selection
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={field.maxSelection ?? ''}
                                        onChange={e => setField({ ...field, maxSelection: e.target.value ? parseInt(e.target.value) : undefined })}
                                        placeholder="No limit"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Maximum number of items user can select (empty = no limit)
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                        <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={e => setField({ ...field, placeholder: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={field.description || ''}
                            onChange={e => setField({ ...field, description: e.target.value })}
                            rows={2}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        />
                    </div>

                    {field.fieldType === FieldType.HybridMinecraftMaterialRefPicker && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Settings JSON</label>
                            <textarea
                                value={field.settingsJson || ''}
                                onChange={e => setField({ ...field, settingsJson: e.target.value })}
                                rows={2}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                placeholder='{"categoryFilter":"ICON","multiSelect":false}'
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Configure categoryFilter or multiSelect for the hybrid material picker.
                            </p>
                        </div>
                    )}

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isRequired"
                                checked={field.isRequired}
                                onChange={e => setField({ ...field, isRequired: e.target.checked })}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="isRequired" className="ml-2 block text-sm text-gray-900">
                                Required
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isReadOnly"
                                checked={field.isReadOnly}
                                onChange={e => setField({ ...field, isReadOnly: e.target.checked })}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="isReadOnly" className="ml-2 block text-sm text-gray-900">
                                Read Only
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isReusable"
                                checked={field.isReusable}
                                onChange={e => setField({ ...field, isReusable: e.target.checked })}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="isReusable" className="ml-2 block text-sm text-gray-900">
                                Reusable Template
                            </label>
                        </div>
                    </div>

                    {field.sourceFieldId && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-blue-50 rounded-md">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span>
                                {field.isLinkedToSource ? 'Linked to template' : 'Copied from template'} (source ID: {field.sourceFieldId})
                            </span>
                        </div>
                    )}

                    {field.fieldType === FieldType.Integer && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Increment Value</label>
                            <input
                                type="number"
                                value={field.incrementValue || 1}
                                onChange={e => setField({ ...field, incrementValue: parseInt(e.target.value) })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                    <button onClick={onCancel} className="btn-secondary">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn-primary">
                        Save Field
                    </button>
                </div>
            </div>
        </div>
    );
};

interface FieldMetadataHintProps {
    fieldName: string;
    metadataFields: FieldMetadataDto[];
}

const FieldMetadataHint: React.FC<FieldMetadataHintProps> = ({ fieldName, metadataFields }) => {
    const metadata = metadataFields.find(mf => mf.fieldName === fieldName);

    if (!metadata) return null;

    return (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            <div className="font-semibold mb-1">Field Information</div>
            <div className="space-y-1">
                <div>
                    <span className="font-medium">Nullable:</span>{' '}
                    {metadata.isNullable ? (
                        <span className="text-blue-600">Yes (optional)</span>
                    ) : (
                        <span className="text-orange-600">No (required)</span>
                    )}
                </div>
                {metadata.hasDefaultValue && (
                    <div>
                        <span className="font-medium">Default Value:</span>{' '}
                        <code className="bg-blue-100 px-1 py-0.5 rounded">
                            {metadata.defaultValue === null || metadata.defaultValue === '' ? '(empty)' : String(metadata.defaultValue)}
                        </code>
                    </div>
                )}
                {!metadata.hasDefaultValue && (
                    <div className="text-gray-600">
                        <span className="font-medium">Default Value:</span> None
                    </div>
                )}
            </div>
        </div>
    );
};

