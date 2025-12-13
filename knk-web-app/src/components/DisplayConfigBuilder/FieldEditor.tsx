import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DisplayFieldDto } from '../../utils/domain/dto/displayConfig/DisplayModels';

interface Props {
    field: DisplayFieldDto;
    onSave: (field: DisplayFieldDto) => void;
    onCancel: () => void;
    entityFields?: string[]; // Available field names from entity metadata
}

export const FieldEditor: React.FC<Props> = ({ field: initialField, onSave, onCancel, entityFields = [] }) => {
    const [field, setField] = useState<DisplayFieldDto>(initialField);

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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Name
                        </label>
                        {entityFields.length > 0 ? (
                            <select
                                value={field.fieldName || ''}
                                onChange={e => setField({ ...field, fieldName: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            >
                                <option value="">None (use template text)</option>
                                {entityFields.map(fn => (
                                    <option key={fn} value={fn}>
                                        {fn}
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
                            Template Text
                        </label>
                        <textarea
                            value={field.templateText || ''}
                            onChange={e => setField({ ...field, templateText: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm font-mono"
                            rows={3}
                            placeholder="e.g., ${streetName} or ${price * quantity}"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Use ${'{'}...{'}'} syntax for variables and calculations
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Type
                        </label>
                        <input
                            type="text"
                            value={field.fieldType || ''}
                            onChange={e => setField({ ...field, fieldType: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            placeholder="e.g., String, Number, DateTime"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Optional: for formatting and display purposes
                        </p>
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
