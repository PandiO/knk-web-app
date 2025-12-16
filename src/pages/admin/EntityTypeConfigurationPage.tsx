import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { EntityTypeConfigurationDto } from '../../types/dtos/metadata/MetadataModels';
import { renderIcon, getAvailableKeys } from '../../utils/iconRegistry';
import { entityTypeConfigurationClient } from '../../apiClients/entityTypeConfigurationClient';

interface FormData {
    entityTypeName: string;
    iconKey: string;
    customIconUrl: string;
    displayColor: string;
    sortOrder: number;
    isVisible: boolean;
}

const INITIAL_FORM: FormData = {
    entityTypeName: '',
    iconKey: 'help',
    customIconUrl: '',
    displayColor: '#000000',
    sortOrder: 0,
    isVisible: true,
};

const DEFAULT_COLORS = [
    '#000000', '#1f2937', '#374151', '#6366f1', '#3b82f6', '#0ea5e9',
    '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f59e0b',
    '#f97316', '#ef4444', '#ec4899', '#a855f7', '#8b5cf6',
];

export const EntityTypeConfigurationPage: React.FC = () => {
    const { baseMetadata, loading: metadataLoading, error: metadataError } = useEntityMetadata();
    const [configurations, setConfigurations] = useState<EntityTypeConfigurationDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadConfigurations();
    }, []);

    const loadConfigurations = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await entityTypeConfigurationClient.getAll();
            setConfigurations(data);
        } catch (err) {
            console.error('Failed to load configurations:', err);
            setError('Failed to load entity configurations');
        } finally {
            setLoading(false);
        }
    };

    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.entityTypeName.trim()) {
            errors.entityTypeName = 'Entity type name is required';
        } else {
            // Check if entity type exists in metadata
            const exists = baseMetadata.some(m => m.entityName === formData.entityTypeName);
            if (!exists) {
                errors.entityTypeName = 'Selected entity type not found';
            }

            // Check for duplicate (excluding current edit)
            const duplicate = configurations.some(
                c => c.entityTypeName === formData.entityTypeName && (!editingId || c.id !== editingId)
            );
            if (duplicate) {
                errors.entityTypeName = 'This entity type is already configured';
            }
        }

        if (!formData.iconKey.trim()) {
            errors.iconKey = 'Icon is required';
        }

        if (formData.sortOrder < 0) {
            errors.sortOrder = 'Sort order must be 0 or greater';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        try {
            setLoading(true);
            setError(null);

            if (editingId) {
                await entityTypeConfigurationClient.update({
                    id: editingId,
                    iconKey: formData.iconKey,
                    customIconUrl: formData.customIconUrl,
                    displayColor: formData.displayColor,
                    sortOrder: formData.sortOrder,
                    isVisible: formData.isVisible,
                });
            } else {
                await entityTypeConfigurationClient.create({
                    entityTypeName: formData.entityTypeName,
                    iconKey: formData.iconKey,
                    customIconUrl: formData.customIconUrl,
                    displayColor: formData.displayColor,
                    sortOrder: formData.sortOrder,
                    isVisible: formData.isVisible,
                });
            }

            await loadConfigurations();
            handleCancel();
        } catch (err) {
            console.error('Failed to save configuration:', err);
            setError('Failed to save configuration. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData(INITIAL_FORM);
        setValidationErrors({});
    };

    const handleEdit = (config: EntityTypeConfigurationDto) => {
        setFormData({
            entityTypeName: config.entityTypeName,
            iconKey: config.iconKey || 'help',
            customIconUrl: config.customIconUrl || '',
            displayColor: config.displayColor || '#000000',
            sortOrder: config.sortOrder,
            isVisible: config.isVisible,
        });
        setEditingId(config.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this configuration?')) return;

        try {
            setLoading(true);
            setError(null);
            await entityTypeConfigurationClient.delete(id);
            await loadConfigurations();
        } catch (err) {
            console.error('Failed to delete configuration:', err);
            setError('Failed to delete configuration. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getEntityTypeLabel = (name: string): string => {
        const metadata = baseMetadata.find(m => m.entityName === name);
        return metadata?.displayName || name;
    };

    const availableIcons = getAvailableKeys();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white shadow-sm rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Entity Type Configuration</h1>
                            <p className="mt-1 text-sm text-gray-500">Manage display properties for entity types</p>
                        </div>
                        {!showForm && (
                            <button
                                onClick={() => {
                                    setFormData(INITIAL_FORM);
                                    setEditingId(null);
                                    setShowForm(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                New Configuration
                            </button>
                        )}
                    </div>

            {(metadataError || error) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-800">Error</h3>
                        <p className="text-sm text-red-700">{metadataError || error}</p>
                    </div>
                </div>
            )}

            {metadataLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {showForm && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                            <h2 className="text-lg font-semibold">
                                {editingId ? 'Edit Entity Type Configuration' : 'New Entity Type Configuration'}
                            </h2>

                            {/* Entity Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Entity Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.entityTypeName}
                                    onChange={e => {
                                        setFormData({ ...formData, entityTypeName: e.target.value });
                                        setValidationErrors({ ...validationErrors, entityTypeName: '' });
                                    }}
                                    disabled={!!editingId}
                                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                    <option value="">Select an entity type...</option>
                                    {baseMetadata.map(meta => (
                                        <option key={meta.entityName} value={meta.entityName}>
                                            {meta.displayName} ({meta.entityName})
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.entityTypeName && (
                                    <p className="text-sm text-red-600 mt-1">{validationErrors.entityTypeName}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Icon Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Icon <span className="text-red-500">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        <select
                                            value={formData.iconKey}
                                            onChange={e => {
                                                setFormData({ ...formData, iconKey: e.target.value });
                                                setValidationErrors({ ...validationErrors, iconKey: '' });
                                            }}
                                            className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                                        >
                                            {availableIcons.map(icon => (
                                                <option key={icon} value={icon}>
                                                    {icon}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                                            <span className="text-gray-600 text-sm">Preview:</span>
                                            {renderIcon(formData.iconKey)}
                                        </div>
                                    </div>
                                    {validationErrors.iconKey && (
                                        <p className="text-sm text-red-600 mt-1">{validationErrors.iconKey}</p>
                                    )}
                                </div>

                                {/* Color Picker */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Display Color
                                    </label>
                                    <div className="space-y-2">
                                        <div className="flex gap-2 flex-wrap">
                                            {DEFAULT_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setFormData({ ...formData, displayColor: color })}
                                                    className={`w-8 h-8 rounded border-2 transition-all ${
                                                        formData.displayColor === color
                                                            ? 'border-gray-800 shadow-md'
                                                            : 'border-gray-300'
                                                    }`}
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                            ))}
                                        </div>
                                        <input
                                            type="color"
                                            value={formData.displayColor}
                                            onChange={e => setFormData({ ...formData, displayColor: e.target.value })}
                                            className="block w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
                                        />
                                        <p className="text-xs text-gray-500">{formData.displayColor}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Sort Order */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Sort Order
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.sortOrder}
                                        onChange={e => {
                                            const val = parseInt(e.target.value, 10);
                                            setFormData({ ...formData, sortOrder: isNaN(val) ? 0 : val });
                                            setValidationErrors({ ...validationErrors, sortOrder: '' });
                                        }}
                                        min="0"
                                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                                    {validationErrors.sortOrder && (
                                        <p className="text-sm text-red-600 mt-1">{validationErrors.sortOrder}</p>
                                    )}
                                </div>

                                {/* Visibility Toggle */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Visibility
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isVisible}
                                            onChange={e => setFormData({ ...formData, isVisible: e.target.checked })}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">
                                            {formData.isVisible ? 'Visible' : 'Hidden'}
                                        </span>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Hidden entities won't appear in lists
                                    </p>
                                </div>
                            </div>

                            {/* Custom Icon URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Custom Icon URL <span className="text-gray-500">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    value={formData.customIconUrl}
                                    onChange={e => setFormData({ ...formData, customIconUrl: e.target.value })}
                                    placeholder="https://example.com/icon.png"
                                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    If provided, this overrides the icon from the registry
                                </p>
                            </div>

                            {/* Form Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingId ? 'Update' : 'Create'} Configuration
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Configurations List */}
                    {!showForm && (
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            {configurations.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <p>No entity type configurations yet.</p>
                                    <p className="text-sm">Create one to customize how entities are displayed.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                                    Entity Type
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                                    Icon
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                                    Color
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                                    Sort Order
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                                    Visible
                                                </th>
                                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {configurations.map(config => (
                                                <tr key={config.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {getEntityTypeLabel(config.entityTypeName)}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{config.entityTypeName}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {renderIcon(config.iconKey)}
                                                            <span className="text-sm text-gray-700">{config.iconKey}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-6 h-6 rounded border border-gray-300"
                                                                style={{ backgroundColor: config.displayColor ?? '#000000' }}
                                                            />
                                                            <span className="text-xs text-gray-600">{config.displayColor}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-sm text-gray-700">{config.sortOrder}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                config.isVisible
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-gray-100 text-gray-800'
                                                            }`}
                                                        >
                                                            {config.isVisible ? 'Visible' : 'Hidden'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => handleEdit(config)}
                                                                disabled={loading}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(config.id)}
                                                                disabled={loading}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
                </div>
            </div>
        </div>
    );
};
