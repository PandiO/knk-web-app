import React from 'react';
import { FormSubmissionProgressDto } from '../../types/dtos/forms/FormModels';
import { FormWizard } from './FormWizard';
import { FeedbackModal } from '../FeedbackModal';

interface JoinEntityFormModalProps {
    open: boolean;
    entityTypeName: string;
    formConfigurationId: string;
    initialFieldValues?: Record<string, unknown>;
    parentProgressId?: string;
    userId: string;
    existingProgressId?: string;
    onComplete: (data: Record<string, unknown>, progress?: FormSubmissionProgressDto) => void;
    onClose: () => void;
}

export const JoinEntityFormModal: React.FC<JoinEntityFormModalProps> = ({
    open,
    entityTypeName,
    formConfigurationId,
    initialFieldValues,
    parentProgressId,
    userId,
    existingProgressId,
    onComplete,
    onClose
}) => {
    const debug = (...args: unknown[]) => console.log('[JOIN_MODAL_DEBUG]', ...args);

    React.useEffect(() => {
        debug('props:update', {
            open,
            entityTypeName,
            formConfigurationId,
            hasInitialFieldValues: !!initialFieldValues,
            initialFieldValueKeys: initialFieldValues ? Object.keys(initialFieldValues) : [],
            parentProgressId,
            existingProgressId
        });
    }, [open, entityTypeName, formConfigurationId, initialFieldValues, parentProgressId, existingProgressId]);

    if (!open) return null;

    const hasRequiredConfig = !!entityTypeName && !!formConfigurationId;
    debug('render:open', {
        hasRequiredConfig,
        entityTypeName,
        formConfigurationId,
        initialFieldValues
    });

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-2xl">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Create Join Entry</h2>
                            <p className="text-sm text-gray-600 mt-1">Fill in the join entity details</p>
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
                        {hasRequiredConfig ? (
                            <FormWizard
                                entityName={entityTypeName}
                                formConfigurationId={formConfigurationId}
                                initialFieldValues={initialFieldValues}
                                userId={userId}
                                existingProgressId={existingProgressId}
                                parentProgressId={parentProgressId}
                                onComplete={(data, progress) => {
                                    debug('onComplete:from-child-wizard', {
                                        data,
                                        progress
                                    });
                                    onComplete(data, progress);
                                }}
                            />
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-600">Unable to load join entity configuration</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!hasRequiredConfig && (
                <FeedbackModal
                    open={!hasRequiredConfig}
                    title="Configuration Error"
                    message="Join entity configuration is missing. Please verify the step configuration."
                    status="error"
                    onClose={onClose}
                />
            )}
        </>
    );
};
