import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, FileText } from 'lucide-react';
import { FormConfigurationDto } from '../utils/domain/dto/forms/FormModels';
import { formConfigClient } from '../io/formConfigClient';
import { logging } from '../utils';

export const FormConfigListPage: React.FC = () => {
    const navigate = useNavigate();
    const [configs, setConfigs] = useState<FormConfigurationDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        try {
            setLoading(true);
            const data = await formConfigClient.getAll();
            setConfigs(data);
        } catch (error) {
            console.error('Failed to load configurations:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this configuration?')) return;

        try {
            await formConfigClient.delete(id);
            setConfigs(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Failed to delete configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.DeleteFailed');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white shadow-sm rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Form Configurations</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Manage dynamic form wizards for different entities
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/form-configurations/new')}
                            className="btn-primary"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Create Configuration
                        </button>
                    </div>

                    <div className="px-6 py-4">
                        {configs.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No configurations</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Get started by creating a new form configuration.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {configs.map(config => (
                                    <div
                                        key={config.id}
                                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-medium text-gray-900">
                                                    {config.configurationName}
                                                </h3>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {config.entityName}
                                                </p>
                                                {config.isDefault && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-2">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {config.description && (
                                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                                {config.description}
                                            </p>
                                        )}

                                        <div className="text-sm text-gray-500 mb-4">
                                            {config.steps.length} step{config.steps.length !== 1 ? 's' : ''}
                                        </div>

                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => navigate(`/admin/form-configurations/edit/${config.id}`)}
                                                className="flex-1 btn-secondary text-sm"
                                            >
                                                <Pencil className="h-4 w-4 mr-1" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(config.id!)}
                                                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
