import React, { useEffect, useState } from 'react';
import { FormConfigurationDto, FormSubmissionProgressDto } from '../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { FormWizard } from './FormWizard';
import { FeedbackModal } from '../FeedbackModal';

interface ChildFormModalProps {
    open: boolean;
    entityTypeName: string;
    parentProgressId?: string;
    userId: string;
    fieldName: string;
    currentStepIndex: number;
    onComplete: (data: any, progress?: FormSubmissionProgressDto) => void;
    onClose: () => void;
}

export const ChildFormModal: React.FC<ChildFormModalProps> = ({
    open,
    entityTypeName,
    parentProgressId,
    userId,
    fieldName,
    currentStepIndex,
    onComplete,
    onClose
}) => {
    const [defaultConfig, setDefaultConfig] = useState<FormConfigurationDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showErrorFeedback, setShowErrorFeedback] = useState(false);

    useEffect(() => {
        if (!open) {
            setDefaultConfig(null);
            setError(null);
            return;
        }

        const loadDefaultConfig = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch default configuration for the object type
                const config = await formConfigClient.getByEntityTypeName(entityTypeName, true);
                
                if (!config || (Array.isArray(config) && config.length === 0)) {
                    setError(`No default form configuration found for ${entityTypeName}`);
                    setShowErrorFeedback(true);
                    setDefaultConfig(null);
                    return;
                }

                const actualConfig = Array.isArray(config) ? config[0] : config;
                setDefaultConfig(actualConfig);
            } catch (err: any) {
                const errorMessage = err?.response?.data?.message || `Failed to load form configuration for ${entityTypeName}`;
                setError(errorMessage);
                setShowErrorFeedback(true);
                setDefaultConfig(null);
            } finally {
                setLoading(false);
            }
        };

        loadDefaultConfig();
    }, [open, entityTypeName]);

    const handleChildComplete = (data: any, progress?: FormSubmissionProgressDto) => {
        onComplete(data, progress);
        onClose();
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-2xl">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Create New {entityTypeName}</h2>
                            <p className="text-sm text-gray-600 mt-1">Fill in the form to create a new {entityTypeName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                                    <p className="mt-4 text-gray-600">Loading form...</p>
                                </div>
                            </div>
                        ) : defaultConfig ? (
                            <FormWizard
                                entityName={entityTypeName}
                                userId={userId}
                                onComplete={handleChildComplete}
                                parentProgressId={parentProgressId}
                                fieldName={fieldName}
                                currentStepIndex={currentStepIndex}
                            />
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-600">Unable to load form configuration</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FeedbackModal
                open={showErrorFeedback}
                title="Configuration Error"
                message={error || 'Failed to load form configuration'}
                status="error"
                onClose={() => {
                    setShowErrorFeedback(false);
                    onClose();
                }}
            />
        </>
    );
};

