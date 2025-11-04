import React, { useState } from 'react';
import { FormFieldDto, StepData } from '../../utils/domain/dto/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { Calendar, Plus, Minus, Search } from 'lucide-react';

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
    // TODO: Fetch objects from API based on field.objectType

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            <div className="flex space-x-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={`Search ${field.objectType || 'objects'}...`}
                        className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                </div>
                {onCreateNew && (
                    <button
                        type="button"
                        onClick={onCreateNew}
                        className="btn-secondary whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Create New
                    </button>
                )}
            </div>
            {value && (
                <div className="mt-2 p-2 bg-indigo-50 rounded-md">
                    <span className="text-sm text-indigo-800">Selected: {value.name || value.id}</span>
                </div>
            )}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const ListField: React.FC<FieldRendererProps> = ({ field, value, onChange, error }) => {
    const items = Array.isArray(value) ? value : [];
    const addItem = () => onChange([...items, {}]);
    const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            <div className="space-y-2">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md">
                        <span className="flex-1 text-sm">Item {index + 1}</span>
                        <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800"
                        >
                            Remove
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
};
