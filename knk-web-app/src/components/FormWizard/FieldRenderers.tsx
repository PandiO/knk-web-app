import React, { useState } from 'react';
import { FormFieldDto, StepData } from '../../utils/domain/dto/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { Calendar, Plus, Minus, Search, X } from 'lucide-react';
import { PagedEntityTable, SelectionConfig } from '../PagedEntityTable/PagedEntityTable';
import { columnDefinitionsRegistry, defaultColumnDefinitions } from '../../config/objectConfigs';

interface FieldRendererProps {
    field: FormFieldDto;
    value: any;
    onChange: (value: any) => void;
    error?: string;
    onBlur?: () => void;
    onCreateNew?: () => void;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
    field,
    value,
    onChange,
    error,
    onBlur,
    onCreateNew
}) => {
    switch (field.fieldType) {
        case FieldType.String:
            return <StringField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />;
        case FieldType.Integer:
            return <IntegerField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />;
        case FieldType.Decimal:
            return <DecimalField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />;
        case FieldType.Boolean:
            return <BooleanField field={field} value={value} onChange={onChange} error={error} />;
        case FieldType.DateTime:
            return <DateTimeField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />;
        case FieldType.Enum:
            return <EnumField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />;
        case FieldType.Object:
            return <ObjectField field={field} value={value} onChange={onChange} error={error} onCreateNew={onCreateNew} />;
        case FieldType.List:
            return <ListField field={field} value={value} onChange={onChange} error={error} />;
        default:
            return <div className="text-sm text-gray-500">Unsupported field type: {field.fieldType}</div>;
    }
};

const StringField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && (
            <p className="text-xs text-gray-500 mb-2">{field.description}</p>
        )}
        <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={field.placeholder}
            disabled={field.isReadOnly}
            rows={3}
            className={`block w-full rounded-md shadow-sm sm:text-sm ${
                error
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary focus:ring-primary'
            } ${field.isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
);

const IntegerField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => {
    const increment = field.incrementValue || 1;
    const handleIncrement = () => onChange((Number(value) || 0) + increment);
    const handleDecrement = () => onChange((Number(value) || 0) - increment);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            <div className="flex items-center space-x-2">
                <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={field.isReadOnly}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                    <Minus className="h-4 w-4" />
                </button>
                <input
                    type="number"
                    value={value || ''}
                    onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
                    onBlur={onBlur}
                    placeholder={field.placeholder}
                    disabled={field.isReadOnly}
                    className={`block w-full rounded-md shadow-sm sm:text-sm text-center ${
                        error
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-primary focus:ring-primary'
                    }`}
                />
                <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={field.isReadOnly}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const DecimalField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
        <input
            type="number"
            step="0.01"
            value={value || ''}
            onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            onBlur={onBlur}
            placeholder={field.placeholder}
            disabled={field.isReadOnly}
            className={`block w-full rounded-md shadow-sm sm:text-sm ${
                error
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary focus:ring-primary'
            }`}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
);

const BooleanField: React.FC<FieldRendererProps> = ({ field, value, onChange, error }) => (
    <div className="flex items-center">
        <input
            type="checkbox"
            id={field.fieldName}
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            disabled={field.isReadOnly}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
        />
        <label htmlFor={field.fieldName} className="ml-2 block text-sm text-gray-900">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {error && <p className="ml-2 text-sm text-red-600">{error}</p>}
    </div>
);

const DateTimeField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
        <div className="relative">
            <input
                type="datetime-local"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                disabled={field.isReadOnly}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${
                    error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-primary focus:ring-primary'
                }`}
            />
            <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
);

const EnumField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => {
    // Parse enum values from defaultValue or placeholder
    const enumValues = (field.defaultValue || field.placeholder || '').split(',').map(v => v.trim()).filter(Boolean);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                disabled={field.isReadOnly}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${
                    error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-primary focus:ring-primary'
                }`}
            >
                <option value="">Select {field.label}</option>
                {enumValues.map(val => (
                    <option key={val} value={val}>{val}</option>
                ))}
            </select>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const ObjectField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onCreateNew }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const selectionConfig: SelectionConfig = {
        mode: 'single'
    };

    const handleSelectionChange = (selected: any[]) => {
        onChange(selected[0] || null);
    };

    // changed: handler to remove selected item
    const handleRemoveSelection = () => {
        onChange(null);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            
            {/* changed: moved selected item display above the table */}
            {value && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-600 font-medium text-sm">
                                {(value.name || value.Name || '?').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-900">
                                {value.name || value.Name || 'Selected Item'}
                            </p>
                            <p className="text-xs text-green-600">ID: {value.id}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemoveSelection}
                        className="text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full p-1"
                        title="Remove selection"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex space-x-2">
                <div className="relative flex-1">
                    <PagedEntityTable
                        entityTypeName={field.objectType!}
                        columns={columnDefinitionsRegistry[field.objectType!]?.default || defaultColumnDefinitions.default}
                        initialQuery={{ page: 1, pageSize: 10}}
                        selectionConfig={selectionConfig}
                        selectedItems={value ? [value] : []}
                        onSelectionChange={handleSelectionChange}
                        showSelectionBanner={false}
                    />
                </div>
                {onCreateNew && (
                    <button
                        type="button"
                        onClick={onCreateNew}
                        className="btn-secondary whitespace-nowrap self-start"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Create New
                    </button>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const ListField: React.FC<FieldRendererProps> = ({ field, value, onChange, error }) => {
    console.log('Rendering ListField with value:', value);
    const items = Array.isArray(value) ? value : [];
    
    const listElementType = field.elementType || FieldType.String;
    const isObjectList = field.objectType != null;

    const selectionConfig: SelectionConfig = {
        mode: 'multiple',
        min: field.minSelection,
        max: field.maxSelection
    };

    const handleSelectionChange = (selected: any[]) => {
        onChange(selected);
    };

    const handleRemoveItem = (itemId: string) => {
        onChange(items.filter(item => item.id !== itemId));
    };

    if (!isObjectList) {
        const addItem = () => onChange([...items, '']);
        const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
        const updateItem = (index: number, newValue: any) => {
            const updated = [...items];
            updated[index] = newValue;
            onChange(updated);
        };

        return (
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            {listElementType === FieldType.String && (
                                <input
                                    type="text"
                                    value={item ?? ''}
                                    onChange={e => updateItem(index, e.target.value)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            )}
                            {listElementType === FieldType.Integer && (
                                <input
                                    type="number"
                                    value={item ?? 0}
                                    onChange={e => updateItem(index, parseInt(e.target.value) || 0)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            )}
                            {listElementType === FieldType.Decimal && (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={item ?? 0}
                                    onChange={e => updateItem(index, parseFloat(e.target.value) || 0)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                            >
                                <Minus className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addItem}
                        className="btn-secondary w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                    </button>
                </div>
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            
            {!field.objectType ? (
                <div className="text-sm text-red-600">
                    Object type is required for Object lists. Please configure this field.
                </div>
            ) : (
                <>
                    {/* changed: moved selected items display above the table */}
                    {items.length > 0 && (
                        <div className="mb-3 space-y-2">
                            <p className="text-xs font-medium text-gray-700">
                                Selected ({items.length}):
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-2">
                                {items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-2 bg-green-50 border border-green-200 rounded-md flex items-center justify-between"
                                    >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                                                <span className="text-green-600 font-medium text-xs">
                                                    {(item.name || item.Name || '?').charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-green-900 truncate">
                                                    {item.name || item.Name || 'Item'}
                                                </p>
                                                <p className="text-xs text-green-600">ID: {item.id}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full p-1 flex-shrink-0"
                                            title="Remove from selection"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-md p-4">
                        <PagedEntityTable
                            entityTypeName={field.objectType}
                            columns={columnDefinitionsRegistry[field.objectType]?.default || defaultColumnDefinitions.default}
                            initialQuery={{ page: 1, pageSize: 5 }}
                            selectionConfig={selectionConfig}
                            selectedItems={items}
                            onSelectionChange={handleSelectionChange}
                            showSearchBar={true}
                            showSelectionBanner={false}
                        />
                    </div>
                </>
            )}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};
