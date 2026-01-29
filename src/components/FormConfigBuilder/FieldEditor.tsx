import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { FieldMetadataDto, EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { metadataClient } from '../../apiClients/metadataClient';
import { mapFieldType } from '../../utils/fieldTypeMapper';
import { ValidationRuleBuilder } from './ValidationRuleBuilder';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import { CreateFieldValidationRuleDto, FieldValidationRuleDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { FeedbackModal } from '../FeedbackModal';

interface Props {
    field: FormFieldDto;
    onSave: (field: FormFieldDto) => void;
    onCancel: () => void;
    metadataFields?: FieldMetadataDto[];
    allFields?: FormFieldDto[];
    onRulesChanged?: () => void;
}

export const FieldEditor: React.FC<Props> = ({
    field: initialField,
    onSave,
    onCancel,
    metadataFields = [],
    allFields = [],
    onRulesChanged
}) => {
    const [field, setField] = useState<FormFieldDto>(initialField);
    const [collectionElementType, setCollectionElementType] = useState<FieldType>(
        initialField.elementType || FieldType.String
    );
    const [entityMetadata, setEntityMetadata] = useState<EntityMetadataDto[]>([]);
    const [worldTaskEnabled, setWorldTaskEnabled] = useState<boolean>(false);
    const [worldTaskType, setWorldTaskType] = useState<string>('');
        const [customTaskType, setCustomTaskType] = useState<string>('');

        // Predefined task types
        const PREDEFINED_TASK_TYPES = [
            'ReagionCreate',
            'LocationSelection',
            'LocationCapture',
            'RegionClaim',
            'VerifyLocation',
            'VerifyStructure',
            'VerifyPlacement',
            'VerifyResource',
            'VerifyBoundary',
            'Custom'
        ];

    const [validationRules, setValidationRules] = useState<FieldValidationRuleDto[]>([]);
    const [rulesLoading, setRulesLoading] = useState<boolean>(false);
    const [showRuleBuilder, setShowRuleBuilder] = useState<boolean>(false);
    const [rulesError, setRulesError] = useState<string | null>(null);
    type RuleFeedbackState = { open: boolean; title: string; message: string; status: 'success' | 'error' | 'info' };
    const [ruleFeedback, setRuleFeedback] = useState<RuleFeedbackState>({ open: false, title: '', message: '', status: 'info' });

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

    // Parse existing settingsJson and initialize world-task state
    useEffect(() => {
        try {
            const current = field.settingsJson ? JSON.parse(field.settingsJson) : {};
            const wt = current?.worldTask || {};
            setWorldTaskEnabled(!!wt.enabled);
                const taskType = typeof wt.taskType === 'string' ? wt.taskType : '';
                setWorldTaskType(taskType);
                // If task type is not in predefined list, set it as custom
                if (taskType && !PREDEFINED_TASK_TYPES.includes(taskType)) {
                    setWorldTaskType('Custom');
                    setCustomTaskType(taskType);
                }
        } catch {
            setWorldTaskEnabled(false);
            setWorldTaskType('');
                setCustomTaskType('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialField.id]);

    const canManageRules = field.id && !field.id.toString().startsWith('temp');

    const loadValidationRules = async () => {
        if (!canManageRules) {
            setValidationRules([]);
            return;
        }
        try {
            setRulesLoading(true);
            setRulesError(null);
            const rules = await fieldValidationRuleClient.getByFormFieldId(parseInt(field.id!, 10));
            setValidationRules(rules);
        } catch (err: any) {
            console.error('Failed to load validation rules:', err);
            setRulesError('Unable to load validation rules. Please try again.');
        } finally {
            setRulesLoading(false);
        }
    };

    useEffect(() => {
        void loadValidationRules();
    }, [field.id]);

    const mergeSettings = (partial: any) => {
        let base: any = {};
        try {
            base = field.settingsJson ? JSON.parse(field.settingsJson) : {};
        } catch {
            base = {};
        }
        const merged = { ...base, ...partial };
        // Special merge for nested worldTask object
        if (partial.worldTask) {
            merged.worldTask = { ...(base.worldTask || {}), ...(partial.worldTask || {}) };
        }
        setField(prev => ({ ...prev, settingsJson: JSON.stringify(merged) }));
    };

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

        // Ensure worldTask settings are persisted/merged into settingsJson synchronously
        const taskTypeToPersist = worldTaskType === 'Custom' ? customTaskType : worldTaskType;
        let baseSettings: any = {};
        try {
            baseSettings = field.settingsJson ? JSON.parse(field.settingsJson) : {};
        } catch {
            baseSettings = {};
        }
        const mergedWorldTask = {
            ...(baseSettings.worldTask || {}),
            enabled: worldTaskEnabled,
            ...(taskTypeToPersist ? { taskType: taskTypeToPersist } : {})
        };
        const mergedSettings = { ...baseSettings, worldTask: mergedWorldTask };

        const fieldToSave: FormFieldDto = {
            ...field,
            settingsJson: JSON.stringify(mergedSettings),
            elementType: isCollectionType(field.fieldType) ? collectionElementType : undefined
        };
        onSave(fieldToSave);
    };

    const handleAddRule = async (rule: CreateFieldValidationRuleDto) => {
        try {
            setRulesError(null);
            await fieldValidationRuleClient.create(rule);
            await loadValidationRules();
            setShowRuleBuilder(false);
            setRuleFeedback({
                open: true,
                title: 'Validation rule added',
                message: 'Rule saved successfully.',
                status: 'success'
            });
            onRulesChanged?.();
        } catch (err: any) {
            console.error('Failed to create validation rule:', err);
            const msg = err?.response?.data?.message || err?.message || 'Failed to create validation rule';
            setRulesError(msg);
            setRuleFeedback({ open: true, title: 'Add rule failed', message: msg, status: 'error' });
        }
    };

    const handleDeleteRule = async (ruleId: number) => {
        if (!window.confirm('Delete this validation rule?')) return;
        try {
            await fieldValidationRuleClient.delete(ruleId);
            await loadValidationRules();
            setRuleFeedback({ open: true, title: 'Validation rule removed', message: 'Rule deleted successfully.', status: 'success' });
            onRulesChanged?.();
        } catch (err: any) {
            console.error('Failed to delete validation rule:', err);
            const msg = err?.response?.data?.message || err?.message || 'Failed to delete validation rule';
            setRulesError(msg);
            setRuleFeedback({ open: true, title: 'Delete failed', message: msg, status: 'error' });
        }
    };

    const resolveFieldLabel = (fieldId?: number) => {
        if (!fieldId) return 'Unknown field';
        const match = allFields.find(f => f.id && parseInt(f.id, 10) === fieldId);
        return match?.label || match?.fieldName || `Field ${fieldId}`;
    };

    const renderValidationRules = () => {
        if (!canManageRules) {
            return (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                    Save this field first to configure cross-field validation rules.
                </div>
            );
        }

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">Cross-Field Validation Rules</h4>
                        {rulesLoading && <span className="text-xs text-gray-500">Loading…</span>}
                        {!rulesLoading && validationRules.length > 0 && (
                            <span className="text-xs text-gray-500">{validationRules.length} configured</span>
                        )}
                    </div>
                    <button
                        className="btn-secondary text-sm"
                        onClick={() => setShowRuleBuilder(true)}
                        disabled={!canManageRules}
                    >
                        + Add Rule
                    </button>
                </div>

                {rulesError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 flex items-start">
                        <ShieldAlert className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>{rulesError}</span>
                    </div>
                )}

                {validationRules.length === 0 && !rulesLoading ? (
                    <p className="text-sm text-gray-500 italic">No validation rules configured.</p>
                ) : (
                    <div className="space-y-2">
                        {validationRules.map(rule => (
                            <div
                                key={rule.id}
                                className="border border-gray-200 rounded-md p-3 bg-gray-50 flex items-start justify-between"
                            >
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-semibold text-gray-900">{rule.validationType}</span>
                                        {rule.isBlocking ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">
                                                Blocking
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                                Warning only
                                            </span>
                                        )}
                                    </div>
                                    {rule.dependsOnFieldId && (
                                        <p className="text-xs text-gray-600">
                                            Depends on: {resolveFieldLabel(rule.dependsOnFieldId)}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-700">{rule.errorMessage}</p>
                                    {rule.successMessage && (
                                        <p className="text-xs text-green-700 flex items-center">
                                            <ShieldCheck className="h-3 w-3 mr-1" />
                                            {rule.successMessage}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="text-red-600 hover:text-red-800 text-sm ml-3"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {showRuleBuilder && (
                    <div className="mt-3">
                        <ValidationRuleBuilder
                            field={field}
                            availableFields={allFields}
                            onSave={handleAddRule}
                            onCancel={() => setShowRuleBuilder(false)}
                        />
                    </div>
                )}
            </div>
        );
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

                    {/* In-Game Action (World Task) configuration */}
                    <div className="mt-4 p-3 rounded-md border border-gray-200">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">Requires in-game action</label>
                            <input
                                type="checkbox"
                                checked={worldTaskEnabled}
                                onChange={e => {
                                    const enabled = e.target.checked;
                                    setWorldTaskEnabled(enabled);
                                    mergeSettings({ worldTask: { enabled } });
                                    if (enabled && !worldTaskType) {
                                            // Set default task type
                                            setWorldTaskType('VerifyLocation');
                                            mergeSettings({ worldTask: { enabled: true, taskType: 'VerifyLocation' } });
                                    }
                                }}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                        </div>
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
                                <select
                                value={worldTaskType}
                                    onChange={e => {
                                        const selectedType = e.target.value;
                                        setWorldTaskType(selectedType);
                                        if (selectedType === 'Custom') {
                                            // Don't set taskType yet, wait for custom input
                                            if (customTaskType) {
                                                mergeSettings({ worldTask: { taskType: customTaskType } });
                                            }
                                        } else {
                                            mergeSettings({ worldTask: { taskType: selectedType || undefined } });
                                            setCustomTaskType(''); // Clear custom input when selecting predefined
                                        }
                                }}
                                disabled={!worldTaskEnabled}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                    <option value="">Select a task type...</option>
                                    {PREDEFINED_TASK_TYPES.map(type => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                {worldTaskType === 'Custom' && (
                                    <input
                                        type="text"
                                        value={customTaskType}
                                        onChange={e => {
                                            setCustomTaskType(e.target.value);
                                            mergeSettings({ worldTask: { taskType: e.target.value || undefined } });
                                        }}
                                        disabled={!worldTaskEnabled}
                                        placeholder="Enter custom task type..."
                                        className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-100"
                                    />
                                )}
                            <p className="mt-1 text-xs text-gray-500">
                                When enabled, the form shows a "Send to Minecraft" action and tracks this task.
                            </p>
                        </div>
                    </div>

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

                    <div className="border-t border-gray-200 pt-4 space-y-3">
                        {renderValidationRules()}
                    </div>
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

            <FeedbackModal
                open={ruleFeedback.open}
                title={ruleFeedback.title}
                message={ruleFeedback.message}
                status={ruleFeedback.status}
                onClose={() => setRuleFeedback(prev => ({ ...prev, open: false }))}
            />
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

