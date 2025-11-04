import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FormFieldDto } from '../../utils/domain/dto/forms/FormModels';
import { FieldType } from '../../utils/enums';

interface Props {
    field: FormFieldDto;
    onSave: (field: FormFieldDto) => void;
    onCancel: () => void;
}

export const FieldEditor: React.FC<Props> = ({ field: initialField, onSave, onCancel }) => {
    const [field, setField] = useState<FormFieldDto>(initialField);

    const handleSave = () => {
        if (!field.fieldName.trim() || !field.label.trim()) {
            alert('Field name and label are required');
            return;
        }
        onSave(field);
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
                            <input
                                type="text"
                                value={field.fieldName}
                                onChange={e => setField({ ...field, fieldName: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                placeholder="e.g., streetName, totalCost"
                            />
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                        <select
                            value={field.fieldType}
                            onChange={e => setField({ ...field, fieldType: e.target.value as FieldType })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        >
                            {Object.values(FieldType).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

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
                    </div>

                    {field.fieldType === FieldType.Object && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Object Type</label>
                            <input
                                type="text"
                                value={field.objectType || ''}
                                onChange={e => setField({ ...field, objectType: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                placeholder="e.g., District, Town"
                            />
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
