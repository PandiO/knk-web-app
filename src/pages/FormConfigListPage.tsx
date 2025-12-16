import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, FileText } from 'lucide-react';
import { logging } from '../utils';
import { metadataClient } from '../apiClients/metadataClient';
import { EntityMetadataDto } from '../types/dtos/metadata/MetadataModels';

export const FormConfigListPage: React.FC = () => {
    const navigate = useNavigate();
    const [entityMetadata, setEntityMetadata] = useState<EntityMetadataDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetadata();
    }, []);

    const loadMetadata = async () => {
        try {
            setLoading(true);
            const data = await metadataClient.getAllEntityMetadata();
            setEntityMetadata(data);
        } catch (error) {
            console.error('Failed to load entity metadata:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
        } finally {
            setLoading(false);
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
                            <h1 className="text-2xl font-bold text-gray-900">Form Builder Entities</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Entities available for form configuration
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/form-configurations/new')}
                            className="btn-primary"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            New (No Prefill)
                        </button>
                    </div>

                    <div className="px-6 py-4">
                        {entityMetadata.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No entities</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    No form-configurable entities were returned.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {entityMetadata.map(em => (
                                    <div
                                        key={em.entityName}
                                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-medium text-gray-900" title={em.displayName}>
                                                    {em.displayName}
                                                </h3>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    ({em.entityName})
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 mb-4">
                                            {em.fields.length} field{em.fields.length !== 1 ? 's' : ''}
                                        </div>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => navigate(`/admin/form-configurations/new?entity=${encodeURIComponent(em.entityName)}`)}
                                                className="w-full btn-primary text-sm"
                                            >
                                                Configure Form
                                            </button>
                                            <button
                                                onClick={() => navigate(`/admin/form-configurations/new?entity=${encodeURIComponent(em.entityName)}&default=true`)}
                                                className="w-full btn-secondary text-xs"
                                            >
                                                Configure As Default
                                            </button>
                                        </div>
                                        <div className="mt-4">
                                            <details className="text-xs">
                                                <summary className="cursor-pointer text-gray-600">Fields</summary>
                                                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                                                    {em.fields.map(f => (
                                                        <li key={f.fieldName} className="flex justify-between">
                                                            <span className="truncate" title={f.fieldName}>{f.fieldName}</span>
                                                            <span className="text-gray-400">{f.fieldType}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
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

