import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DisplayFieldDto } from '../../utils/domain/dto/displayConfig/DisplayModels';
import { FieldMetadataDto } from '../../utils/domain/dto/metadata/MetadataModels';
import { FieldType } from '../../utils/enums';
import { mapFieldType } from '../../utils/fieldTypeMapper';
import { metadataClient } from '../../apiClients/metadataClient';

interface RelatedEntityOption {
    propertyName: string; // e.g., "ParentCategory", "IconMaterialRef"
    entityTypeName: string; // e.g., "Category", "MinecraftMaterialRef"
    displayLabel: string; // e.g., "ParentCategory (Category)"
}

interface Props {
    field: DisplayFieldDto;
    onSave: (field: DisplayFieldDto) => void;
    onCancel: () => void;
    metadataFields?: FieldMetadataDto[]; // Available field metadata from main entity or section's related entity
    sectionDedicatedToEntity?: { propertyName: string; entityTypeName: string }; // If section is dedicated to a related entity
}

export const FieldEditor: React.FC<Props> = ({ field: initialField, onSave, onCancel, metadataFields = [], sectionDedicatedToEntity }) => {
    const [field, setField] = useState<DisplayFieldDto>(initialField);
    const [relatedEntityOptions, setRelatedEntityOptions] = useState<RelatedEntityOption[]>([]);
    const [relatedEntityFields, setRelatedEntityFields] = useState<FieldMetadataDto[]>([]);
    const [loadingRelatedMetadata, setLoadingRelatedMetadata] = useState(false);

    // Extract related entity navigation properties from metadata
    useEffect(() => {
        // Show both navigation properties and their foreign key fields (e.g., IconMaterialRef and IconMaterialRefId)
        const navOptions: RelatedEntityOption[] = metadataFields
            .filter(f => f.isRelatedEntity && f.relatedEntityType)
            .map(f => ({
                propertyName: f.fieldName,
                entityTypeName: f.relatedEntityType!,
                displayLabel: `${f.fieldName} (${f.relatedEntityType})`
            }));

        // Also include foreign key fields that have a matching navigation property
        const navPropertyNames = new Set(navOptions.map(o => o.propertyName));
        const fkOptions: RelatedEntityOption[] = metadataFields
            .filter(f => {
                // Heuristic: foreign key fields end with 'Id' and have a matching navigation property
                if (!f.fieldName.endsWith('Id')) return false;
                const navName = f.fieldName.replace(/Id$/, '');
                return navPropertyNames.has(navName);
            })
            .map(fk => {
                const navName = fk.fieldName.replace(/Id$/, '');
                const nav = navOptions.find(o => o.propertyName === navName);
                return nav ? { ...nav, propertyName: navName } : null;
            })
            .filter(Boolean) as RelatedEntityOption[];

        // Merge and deduplicate by propertyName
        const allOptions = [...navOptions, ...fkOptions].filter((opt, idx, arr) =>
            arr.findIndex(o => o.propertyName === opt.propertyName) === idx
        );
        setRelatedEntityOptions(allOptions);
    }, [metadataFields]);

    // Load metadata for related entity when selected
    useEffect(() => {
        if (field.relatedEntityPropertyName && field.relatedEntityTypeName) {
            loadRelatedEntityMetadata(field.relatedEntityTypeName);
        } else {
            setRelatedEntityFields([]);
        }
    }, [field.relatedEntityPropertyName, field.relatedEntityTypeName]);

    const loadRelatedEntityMetadata = async (entityTypeName: string) => {
        setLoadingRelatedMetadata(true);
        try {
            const metadata = await metadataClient.getEntityMetadata(entityTypeName);
            setRelatedEntityFields(metadata.fields);
        } catch (err) {
            console.error('Failed to load related entity metadata:', err);
            setRelatedEntityFields([]);
        } finally {
            setLoadingRelatedMetadata(false);
        }
    };

    const handleRelatedEntityChange = (value: string) => {
        if (!value) {
            // Clear related entity selection
            setField(prev => ({
                ...prev,
                relatedEntityPropertyName: undefined,
                relatedEntityTypeName: undefined,
                fieldName: undefined,
                fieldType: undefined
            }));
        } else {
            const option = relatedEntityOptions.find(o => o.propertyName === value);
            if (option) {
                setField(prev => ({
                    ...prev,
                    relatedEntityPropertyName: option.propertyName,
                    relatedEntityTypeName: option.entityTypeName,
                    fieldName: undefined, // Reset field selection
                    fieldType: undefined
                }));
            }
        }
    };

    const handleFieldNameChange = (selectedFieldName: string) => {
        // Determine which metadata to use (main entity or related entity)
        const sourceMetadata = field.relatedEntityPropertyName ? relatedEntityFields : metadataFields;
        const metaField = sourceMetadata.find(mf => mf.fieldName === selectedFieldName);
        
        if (metaField) {
            setField(prev => ({
                ...prev,
                fieldName: metaField.fieldName,
                label: prev.label || metaField.fieldName, // auto-populate label if empty
                fieldType: mapFieldType(metaField.fieldType) // auto-populate type
            }));
        } else {
            setField(prev => ({ ...prev, fieldName: selectedFieldName }));
        }
    };

    // Get current field options (main entity, section's related entity, or field's related entity)
    // Priority: field-level dedication > section-level dedication > main entity
    const currentFieldOptions = field.relatedEntityPropertyName 
        ? relatedEntityFields 
        : metadataFields;

    const handleSave = () => {
        if (!field.label.trim()) {
            alert('Label is required');
            return;
        }

        onSave(field);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                        {field.id ? 'Edit Display Field' : 'New Display Field'}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                    {field.sourceFieldId && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
                                <strong>{field.isLinkedToSource ? 'Linked' : 'Copied'}</strong> from template field (ID: {field.sourceFieldId})
                            </p>
                        </div>
                    )}

                    {field.hasCompatibilityIssues && field.compatibilityIssues && field.compatibilityIssues.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex items-start">
                                <svg className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-red-800 mb-1">Compatibility Issues</h4>
                                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                        {field.compatibilityIssues.map((issue, idx) => (
                                            <li key={idx}>{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

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

                    {/* Related Entity Selection - always show to allow field-level dedication */}
                    {relatedEntityOptions.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dedicated to Related Entity
                            </label>
                            <select
                                value={field.relatedEntityPropertyName || ''}
                                onChange={e => handleRelatedEntityChange(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            >
                                <option value="">None (use {sectionDedicatedToEntity ? sectionDedicatedToEntity.propertyName : 'main entity'})</option>
                                {relatedEntityOptions.map(option => (
                                    <option key={option.propertyName} value={option.propertyName}>
                                        {option.displayLabel}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                {sectionDedicatedToEntity 
                                    ? `Select a related entity from ${sectionDedicatedToEntity.propertyName} to display its fields`
                                    : 'Select a related entity to display its fields'}
                            </p>
                        </div>
                    )}

                    {/* Show section dedication info if section is dedicated */}
                    {sectionDedicatedToEntity && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
                                This field belongs to <strong>{sectionDedicatedToEntity.propertyName}</strong> ({sectionDedicatedToEntity.entityTypeName})
                            </p>
                        </div>
                    )}

                    {/* Field Name and Field Type - Grouped */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Field Configuration
                            {(field.relatedEntityPropertyName || sectionDedicatedToEntity) && (
                                <span className="ml-2 text-xs font-normal text-blue-600">
                                    (from {sectionDedicatedToEntity?.entityTypeName || field.relatedEntityTypeName})
                                </span>
                            )}
                        </h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Field Name
                                </label>
                                {(loadingRelatedMetadata || (sectionDedicatedToEntity && metadataFields.length === 0)) ? (
                                    <div className="text-sm text-gray-500 py-2">Loading fields...</div>
                                ) : currentFieldOptions.length > 0 ? (
                                    <select
                                        value={field.fieldName || ''}
                                        onChange={e => handleFieldNameChange(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    >
                                        <option value="">None (use template text)</option>
                                        {currentFieldOptions.map(mf => (
                                            <option key={mf.fieldName} value={mf.fieldName}>
                                                {mf.fieldName} ({mf.fieldType})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={field.fieldName || ''}
                                        onChange={e => setField({ ...field, fieldName: e.target.value })}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                        placeholder="e.g., streetName, totalCost"
                                    />
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    Leave empty to use only template text
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Field Type
                                </label>
                                <select
                                    value={field.fieldType || ''}
                                    onChange={e => setField({ ...field, fieldType: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">Select a type...</option>
                                    {Object.values(FieldType).map(type => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    Optional: for formatting and display purposes
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={field.description || ''}
                            onChange={e => setField({ ...field, description: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            rows={2}
                            placeholder="Optional description for documentation"
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isReusable"
                            checked={field.isReusable || false}
                            onChange={e => setField({ ...field, isReusable: e.target.checked })}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="isReusable" className="ml-2 block text-sm text-gray-700">
                            Mark as Reusable Template
                        </label>
                    </div>

                    {(() => {
                        const eligibleTypes = ['string', 'integer', 'number', 'boolean'];
                        const typeLower = (field.fieldType || '').toLowerCase();
                        const isEligible = eligibleTypes.includes(typeLower);
                        return isEligible ? (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isEditableInDisplay"
                                    checked={field.isEditableInDisplay || false}
                                    onChange={e => setField({ ...field, isEditableInDisplay: e.target.checked })}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                                <label htmlFor="isEditableInDisplay" className="ml-2 block text-sm text-gray-700">
                                    Enable Hot Edit in Display (String, Integer, Boolean)
                                </label>
                            </div>
                        ) : null;
                    })()}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark"
                    >
                        Save Field
                    </button>
                </div>
            </div>
        </div>
    );
};
