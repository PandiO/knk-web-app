import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FormConfigurationDto, FormSubmissionProgressDto } from '../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { workflowClient } from '../../apiClients/workflowClient';
import { FormWizard } from './FormWizard';
import { FeedbackModal } from '../FeedbackModal';
import { findParentLinkField } from '../../utils/forms/findParentLinkField';

interface ChildFormModalProps {
    open: boolean;
    entityTypeName: string;
    entityId?: string;
    // Resume an existing draft/in-progress FormSubmissionProgress rather than creating new or
    // editing a persisted entity - mutually exclusive with entityId. Used by the relationship-
    // drafts feature's "Continue" action.
    existingProgressId?: string;
    parentProgressId?: string;
    userId: string;
    fieldName: string;
    currentStepIndex: number;
    workflowSessionId?: number;
    worldTaskHint?: string;
    // The type name and current form-state snapshot of the parent entity this child is being
    // created under (e.g. "GateStructure" + its in-progress field values). When the child's own
    // default FormConfiguration has an Object-type field referencing that same parent type (e.g.
    // GateDoor's "GateStructureId"), that field is pre-filled with the snapshot so the admin
    // doesn't have to re-search for the entity they're already inside. Ignored in edit/resume mode.
    parentEntityTypeName?: string;
    parentEntitySnapshot?: Record<string, unknown>;
    // The parent form's current values + id, for the child's pickerFilters {parent.X} tokens. Unlike
    // parentEntitySnapshot it is passed in edit mode too.
    parentContext?: Record<string, unknown>;
    onComplete: (data: any, progress?: FormSubmissionProgressDto) => void | Promise<void>;
    onClose: () => void;
}

export const ChildFormModal: React.FC<ChildFormModalProps> = ({
    open,
    entityTypeName,
    entityId,
    existingProgressId,
    parentProgressId,
    userId,
    fieldName,
    currentStepIndex,
    workflowSessionId,
    worldTaskHint,
    parentEntityTypeName,
    parentEntitySnapshot,
    parentContext,
    onComplete,
    onClose
}) => {
    const [defaultConfig, setDefaultConfig] = useState<FormConfigurationDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showErrorFeedback, setShowErrorFeedback] = useState(false);
    const activeLoadKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!open) {
            setDefaultConfig(null);
            setError(null);
            activeLoadKeyRef.current = null;
            return;
        }

        const loadKey = `${entityTypeName}:${worldTaskHint || ''}`;
        if (activeLoadKeyRef.current === loadKey) {
            return;
        }
        activeLoadKeyRef.current = loadKey;

        let cancelled = false;

        const loadDefaultConfig = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch default configuration for the object type
                const config = await formConfigClient.getByEntityTypeName(entityTypeName, true);
                
                if (!config || (Array.isArray(config) && config.length === 0)) {
                    if (cancelled) return;
                    setError(`No default form configuration found for ${entityTypeName}`);
                    setShowErrorFeedback(true);
                    setDefaultConfig(null);
                    return;
                }

                const actualConfig = Array.isArray(config) ? config[0] : config;
                if (cancelled) return;
                setDefaultConfig(actualConfig);
            } catch (err: any) {
                if (cancelled) return;
                const errorMessage = err?.response?.data?.message || `Failed to load form configuration for ${entityTypeName}`;
                setError(errorMessage);
                setShowErrorFeedback(true);
                setDefaultConfig(null);
            } finally {
                if (cancelled) return;
                setLoading(false);
            }
        };

        loadDefaultConfig();

        return () => {
            cancelled = true;
        };
    }, [open, entityTypeName, worldTaskHint]);

    // `workflowSessionId` (the prop) is only ever supplied when THIS child form was opened
    // because the parent's own field is itself world-task-enabled (see FormWizard.handleOpenChildForm's
    // worldTaskHint) - reusing the parent's session in that narrow case. For every other reason a
    // child form gets opened (e.g. "Create New" on a plain Object/List field), no session gets
    // passed down at all, which breaks any world-task-enabled field *inside* the child's own form
    // (e.g. GateDoor's AnchorPoint "Send to Minecraft" button never renders - canRenderWorldTaskPanel
    // requires a non-null workflowSessionId). Mirrors FormWizardPage's own session creation so the
    // nested wizard is just as capable as a top-level one.
    const [ownWorkflowSessionId, setOwnWorkflowSessionId] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!open || workflowSessionId != null || !defaultConfig) {
            if (!open) setOwnWorkflowSessionId(undefined);
            return;
        }

        let cancelled = false;

        const createOwnSession = async () => {
            try {
                const cfgIdNum = defaultConfig.id ? parseInt(String(defaultConfig.id), 10) : undefined;
                const entityIdNum = entityId ? parseInt(String(entityId), 10) : undefined;
                const session = await workflowClient.createSession({
                    userId: parseInt(userId, 10) || 0,
                    formConfigurationId: cfgIdNum,
                    entityTypeName,
                    entityId: entityIdNum
                });
                if (!cancelled) setOwnWorkflowSessionId(session.id);
            } catch (err) {
                if (!cancelled) setOwnWorkflowSessionId(undefined);
            }
        };

        void createOwnSession();

        return () => {
            cancelled = true;
        };
    }, [open, workflowSessionId, defaultConfig, entityTypeName, entityId, userId]);

    const effectiveWorkflowSessionId = workflowSessionId ?? ownWorkflowSessionId;

    const [completing, setCompleting] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Found live (2026-09-23): this used to call onComplete without awaiting it, so a genuine
    // save failure inside it (e.g. a foreign key constraint violation from a bad pre-filled
    // value - see findParentLinkField's own fix for the specific bug this surfaced) still closed
    // the modal immediately, as if the save had succeeded. The child's data - and any explanation
    // of what went wrong - was simply gone. Now awaits it and keeps the modal open (and the
    // admin's in-progress data intact) on failure, showing the real error via its own feedback
    // state - kept separate from the config-loading error above, since that one closes the whole
    // modal on dismiss (no usable form exists yet) while this one must not.
    const handleChildComplete = async (data: any, progress?: FormSubmissionProgressDto) => {
        setCompleting(true);
        try {
            await onComplete(data, progress);
            onClose();
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || `Failed to save ${entityTypeName}. Please try again.`;
            setSaveError(message);
        } finally {
            setCompleting(false);
        }
    };

    const isEditMode = !!entityId;
    const isResuming = !!existingProgressId;

    // Prefill any field on this child's own form that links back to the parent entity it's being
    // created under (e.g. GateDoor's "GateStructureId" when created from within a GateStructure
    // form), so the admin doesn't have to re-search for the entity they're already inside. Not for
    // edit mode (a persisted entity already has its own data) or resume mode (a draft already has
    // whatever it was saved with, including its own link field value).
    const initialFieldValues = useMemo(() => {
        if (isEditMode || isResuming || !parentEntitySnapshot) {
            return undefined;
        }
        const linkField = findParentLinkField(defaultConfig, parentEntityTypeName);
        return linkField ? { [linkField.fieldName]: parentEntitySnapshot } : undefined;
    }, [isEditMode, isResuming, defaultConfig, parentEntityTypeName, parentEntitySnapshot]);

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-2xl">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {isEditMode ? `Edit ${entityTypeName}` : isResuming ? `Continue draft ${entityTypeName}` : `Create New ${entityTypeName}`}
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {isEditMode
                                    ? `Update the ${entityTypeName} details`
                                    : isResuming
                                        ? `Resume where this draft was left off`
                                        : `Fill in the form to create a new ${entityTypeName}`}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={completing}
                            className="text-gray-500 hover:text-gray-700 text-2xl disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Close"
                            title={completing ? 'Saving…' : 'Close'}
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
                                entityId={entityId}
                                existingProgressId={existingProgressId}
                                userId={userId}
                                onComplete={handleChildComplete}
                                parentProgressId={parentProgressId}
                                fieldName={fieldName}
                                currentStepIndex={currentStepIndex}
                                workflowSessionId={effectiveWorkflowSessionId}
                                worldTaskHint={worldTaskHint}
                                initialFieldValues={initialFieldValues}
                                parentContext={parentContext}
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

            <FeedbackModal
                open={!!saveError}
                title="Save Failed"
                message={saveError || `Failed to save ${entityTypeName}.`}
                status="error"
                onClose={() => setSaveError(null)}
            />
        </>
    );
};

