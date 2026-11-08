import React from 'react';
import { FormSubmissionProgressDto } from '../../types/dtos/forms/FormModels';
import { FormWizard } from './FormWizard';
import { FeedbackModal } from '../FeedbackModal';
import { Dialog } from '../Dialog';

interface JoinEntityFormModalProps {
    open: boolean;
    entityTypeName: string;
    formConfigurationId: string;
    initialFieldValues?: Record<string, unknown>;
    parentProgressId?: string;
    existingProgressId?: string;
    // The parent form's current values + id (-1 while unsaved), for pickerFilters {parent.X} tokens.
    parentContext?: Record<string, unknown>;
    onComplete: (data: Record<string, unknown>, progress?: FormSubmissionProgressDto) => void;
    onClose: () => void;
}

export const JoinEntityFormModal: React.FC<JoinEntityFormModalProps> = ({
    open,
    entityTypeName,
    formConfigurationId,
    initialFieldValues,
    parentProgressId,
    existingProgressId,
    parentContext,
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
            <Dialog
                open
                onClose={onClose}
                title="Create Join Entry"
                description="Fill in the join entity details"
                size="full"
                closeLabel="Close"
                bodyClassName="p-6"
                data-testid="join-entity-form-modal"
            >
                {hasRequiredConfig ? (
                    <FormWizard
                        entityName={entityTypeName}
                        formConfigurationId={formConfigurationId}
                        initialFieldValues={initialFieldValues}
                        existingProgressId={existingProgressId}
                        parentProgressId={parentProgressId}
                        parentContext={parentContext}
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
                        <p className="text-muted">Unable to load join entity configuration</p>
                    </div>
                )}
            </Dialog>

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
