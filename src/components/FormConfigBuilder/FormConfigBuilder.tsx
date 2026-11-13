import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, AlertCircle, Loader2, Copy, Info } from 'lucide-react';
import { FormConfigurationBuilderState, FormConfigurationDto, FormStepDto, FormFieldDto, ReuseLinkMode } from '../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { logging } from '../../utils';
import { StepEditor } from './StepEditor';
import { stepConditionsPublishProblem } from '../../utils/forms/stepConditions';
import { getManyToManyStepIssues } from '../../utils/forms/manyToManyStepValidation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableStepItem } from './SortableStepItem';
import { toast } from '../../utils/toast';
import { ReusableStepSelector } from './ReusableStepSelector';
import { ConfigurationHealthPanel } from './ConfigurationHealthPanel';
import { detectProjectionCycles } from '../../utils/forms/valueProjection';
import { useConfirm } from '../../hooks/useConfirm';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { CONTENT_PERMISSION_NODE } from '../../hooks/useStaffAccess';
import { useBuilderLeaveGuard } from '../../hooks/useBuilderLeaveGuard';
import { BuilderBusy, BuilderToolbar, ToolbarGate } from '../configBuilder/BuilderToolbar';
import { PublishDialog } from '../configBuilder/PublishDialog';
import { DuplicateDialog } from '../configBuilder/DuplicateDialog';
import { ScaffoldDialog } from '../configBuilder/ScaffoldDialog';
import { FormPreview } from '../configBuilder/FormPreview';
import { PublishSummary, summarizeFormPublish } from '../../utils/configBuilder/publishSummary';
import { formFieldNames, newGuid, ScaffoldCandidate, scaffoldFormSteps } from '../../utils/configBuilder/scaffold';

const WRITE_NODES = [CONTENT_PERMISSION_NODE];

/** The body the API stores: step and field order as GUID arrays (what the old Save sent). */
export function formConfigForSave(config: FormConfigurationDto): FormConfigurationDto {
    return {
        ...config,
        stepOrderJson: JSON.stringify(config.steps.map(s => s.stepGuid)),
        steps: config.steps.map(step => ({
            ...step,
            fieldOrderJson: JSON.stringify(step.fields.map(f => f.fieldGuid))
        }))
    };
}

const snapshotOf = (config: FormConfigurationDto): string => {
    const { isDraft, hasUnpublishedChanges, draftSavedAt, publishedAt, createdAt, updatedAt, ...rest } = formConfigForSave(config);
    return JSON.stringify(rest);
};

/**
 * The form builder (PandiO/knk-workspace#71). Save keeps the builder open and stores a **draft**: the form wizard keeps
 * using the published version until **Publish** (with a summary of what changes for staff). Save and close, Duplicate,
 * Generate from metadata and a live preview sit in the toolbar; leaving with unsaved changes asks first.
 */
export const FormConfigBuilder: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const configId = id || 'new';
    const isEditMode = configId !== 'new';

    const [config, setConfig] = useState<FormConfigurationDto>({
        entityTypeName: '',
        configurationName: '',
        description: '',
        isDefault: false,
        steps: []
    });

    const [builderState, setBuilderState] = useState<FormConfigurationBuilderState | null>(null);
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [reusableSteps, setReusableSteps] = useState<FormStepDto[]>([]);
    const [reusableFields, setReusableFields] = useState<FormFieldDto[]>([]);
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(isEditMode);
    const [busy, setBusy] = useState<BuilderBusy>(null);
    const [error, setError] = useState<string | null>(null);
    const [showStepSelector, setShowStepSelector] = useState(false);
    const [metadata, setMetadata] = useState<EntityMetadataDto[]>([]);
    const [selectedEntityMeta, setSelectedEntityMeta] = useState<EntityMetadataDto | null>(null);
    const [healthRefreshToken, setHealthRefreshToken] = useState(0);
    const [confirm, confirmModal] = useConfirm();
    const [healthIssueCount, setHealthIssueCount] = useState<number>(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [scaffoldOpen, setScaffoldOpen] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [publishOpen, setPublishOpen] = useState(false);
    const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
    const [publishError, setPublishError] = useState<string | null>(null);

    // A new configuration's default would replace this one (new configurations have no builder state yet).
    const [defaultConflictName, setDefaultConflictName] = useState<string | null>(null);
    const [configNameSuggestion, setConfigNameSuggestion] = useState<string>('');
    // Using ref instead of state to avoid infinite dependency loops
    const entityConfigCountsRef = useRef<Record<string, number>>({});
    // After the first Save the route moves to /edit/:id; the builder keeps what it has instead of reloading.
    const justCreatedRef = useRef<string | null>(null);

    const contentGate = useAllNodesGate(WRITE_NODES);
    const writeGate: ToolbarGate = { allowed: contentGate.allowed, reason: contentGate.hint };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Back to the Forms page (where the builders are opened from), on this config's entity.
    const formsPagePath = config.entityTypeName
        ? `/forms/${encodeURIComponent(config.entityTypeName)}`
        : '/forms';

    const dirty = savedSnapshot === null
        ? config.steps.length > 0 || !!config.description?.trim()
        : snapshotOf(config) !== savedSnapshot;
    const leaveGuard = useBuilderLeaveGuard(dirty, `"${config.configurationName || 'this form'}"`);

    const applyState = useCallback((state: FormConfigurationBuilderState) => {
        setBuilderState(state);
        setConfig(state.configuration);
        setSavedSnapshot(snapshotOf(state.configuration));
    }, []);

    const loadData = useCallback(async () => {
        if (justCreatedRef.current && justCreatedRef.current === configId) return;
        try {
            setLoading(true);
            setError(null);

            const [stepsData, fieldsData] = await Promise.all([
                formConfigClient.getReusableSteps(),
                formConfigClient.getReusableFields()
            ]);
            setReusableSteps(stepsData);
            setReusableFields(fieldsData);

            // #71: the working copy (saved draft, else the published version).
            if (isEditMode && configId) {
                applyState(await formConfigClient.getBuilderState(configId));
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            setError(apiRefusalReason(err) ?? 'Failed to load form configuration');
            logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
        } finally {
            setLoading(false);
        }
    }, [isEditMode, configId, applyState]);

    useEffect(() => {
        void loadData();
    }, [configId, loadData]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const entityParam = params.get('entity');
        const defaultFlag = params.get('default') === 'true';

        const loadMeta = async () => {
            try {
                const all = await metadataClient.getAllEntityMetadata();
                setMetadata(all);
                if (!isEditMode) {
                    const pre = entityParam
                        ? all.find(m => m.entityName.toLowerCase() === entityParam.toLowerCase())
                        : null;
                    if (pre) {
                        setConfig(prev => ({
                            ...prev,
                            entityTypeName: pre.entityName,
                            isDefault: defaultFlag ? true : prev.isDefault
                        }));
                        setSelectedEntityMeta(pre);
                    }
                }
            } catch (e) {
                console.error('Failed to load metadata', e);
                logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
            }
        };
        loadMeta();
    }, [configId, isEditMode]);

    useEffect(() => {
        if (config.entityTypeName) {
            const meta = metadata.find(m => m.entityName === config.entityTypeName) || null;
            setSelectedEntityMeta(meta);

            // Auto-generate configuration name for new configurations when entity is selected
            if (!isEditMode) {
                const currentCount = (entityConfigCountsRef.current[config.entityTypeName] ?? 0) + 1;
                const generatedName = `${config.entityTypeName} Template ${currentCount}`;
                setConfigNameSuggestion(generatedName);

                setConfig(prev => {
                    if (!prev.configurationName || prev.configurationName.startsWith(`${config.entityTypeName} Template`)) {
                        return { ...prev, configurationName: generatedName };
                    }
                    return prev;
                });

                entityConfigCountsRef.current[config.entityTypeName] = currentCount;
            }
        } else {
            setSelectedEntityMeta(null);
            setConfigNameSuggestion('');
        }
    }, [config.entityTypeName, metadata, isEditMode]);

    const allFieldsInConfiguration = useMemo(() => {
        const collectFields = (steps: FormStepDto[]): FormFieldDto[] => {
            const directFields = steps.flatMap(s => s.fields || []);
            const childFields = steps.flatMap(s => collectFields(s.childFormSteps || []));
            return [...directFields, ...childFields];
        };
        return collectFields(config.steps || []);
    }, [config.steps]);

    const existingFieldNames = useMemo(() => formFieldNames(config.steps), [config.steps]);

    const generateTempId = () => `temp-${Date.now()}-${Math.random()}`;

    const cloneField = (field: FormFieldDto): FormFieldDto => ({
        ...field,
        id: generateTempId(),
        formStepId: undefined,
        fieldGuid: newGuid(),
        sourceFieldId: field.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined,
        validations: field.validations.map(v => ({ ...v, id: undefined, formFieldId: undefined })),
        displayConditionGroups: []
    });

    const cloneStep = (step: FormStepDto): FormStepDto => ({
        ...step,
        id: undefined,
        formConfigurationId: undefined,
        stepGuid: newGuid(),
        sourceStepId: step.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        stepLevelIssues: undefined,
        fields: step.fields.map(f => cloneField(f)),
        conditions: step.conditions.map(c => ({ ...c, id: undefined, formStepId: undefined })),
        // Conditions point at fields of the source configuration, which do not exist here.
        displayConditionGroups: []
    });

    const handleAddNewStep = () => {
        const newStep: FormStepDto = {
            id: generateTempId(),
            stepGuid: newGuid(),
            stepName: `Step ${config.steps.length + 1}`,
            description: '',
            order: config.steps.length,
            fieldOrderJson: '[]',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isManyToManyRelationship: false,
            relatedEntityPropertyName: undefined,
            joinEntityType: undefined,
            subConfigurationId: undefined,
            childFormSteps: [],
            fields: [],
            conditions: []
        };

        setConfig(prev => ({
            ...prev,
            steps: [...prev.steps, newStep]
        }));
        setSelectedStepIndex(config.steps.length);
    };

    // #71: a template step is copied into the working copy (live on Publish). The API's add-from-template wrote
    // straight into the published form, so the builder no longer calls it.
    const handleAddReusableStep = (templateStep: FormStepDto, mode: ReuseLinkMode) => {
        const clonedStep = cloneStep(templateStep);
        clonedStep.id = generateTempId();
        clonedStep.order = config.steps.length;
        clonedStep.isLinkedToSource = mode === 'link';

        setConfig(prev => ({
            ...prev,
            steps: [...prev.steps, clonedStep]
        }));
        setShowStepSelector(false);
        setSelectedStepIndex(config.steps.length);
    };

    const handleDeleteStep = (index: number) => {
        setConfig(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }))
        }));
        if (selectedStepIndex === index) {
            setSelectedStepIndex(null);
        } else if (selectedStepIndex && selectedStepIndex > index) {
            setSelectedStepIndex(selectedStepIndex - 1);
        }
    };

    const handleStepDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setConfig(prev => {
                const oldIndex = prev.steps.findIndex(s => s.id === active.id);
                const newIndex = prev.steps.findIndex(s => s.id === over.id);

                const reorderedSteps = arrayMove(prev.steps, oldIndex, newIndex).map((s, i) => ({
                    ...s,
                    order: i
                }));

                return { ...prev, steps: reorderedSteps };
            });
        }
    };

    const handleUpdateStep = (updatedStep: FormStepDto) => {
        setConfig(prev => ({
            ...prev,
            steps: prev.steps.map((s, i) =>
                i === selectedStepIndex ? updatedStep : s
            )
        }));
    };

    /** What a draft needs: an entity and a name. Everything else may be unfinished until Publish. */
    const draftProblem = (): string | null => {
        if (!config.entityTypeName.trim()) return 'Choose an entity first.';
        if (!config.configurationName.trim()) return 'Give the configuration a name.';
        return null;
    };

    /** Everything the old Save checked: the wizard can't run an unfinished form, so Publish needs it. */
    const publishProblem = (): string | null => {
        const draft = draftProblem();
        if (draft) return draft;
        if (config.steps.length === 0) return 'At least one step is required.';

        for (const step of config.steps) {
            if (!step.stepName.trim()) return `Step ${step.order + 1} must have a name.`;
            const m2mIssues = getManyToManyStepIssues(step);
            if (m2mIssues.length > 0) {
                return `Step ${step.order + 1} (${step.stepName}) has many-to-many configuration issues: ${m2mIssues.map(i => i.message).join(' ')}`;
            }
            // PandiO/knk-workspace#88: a draft may hold an unfinished condition, the published form may not.
            const conditionProblem = stepConditionsPublishProblem(step);
            if (conditionProblem) return conditionProblem;
        }

        const projectionCycles = detectProjectionCycles(
            allFieldsInConfiguration
                .filter(field => !!field.fieldName)
                .map(field => ({
                    fieldName: field.fieldName,
                    settingsJson: field.settingsJson
                }))
        );
        if (projectionCycles.length > 0) {
            return `Value projection contains circular mappings: ${projectionCycles.join(' | ')}. Remove the loop before publishing.`;
        }
        return null;
    };

    /** Saves the working copy as a draft (creating the configuration the first time). Null when it failed. */
    const saveDraft = async (options: { quiet?: boolean } = {}): Promise<FormConfigurationBuilderState | null> => {
        const problem = draftProblem();
        if (problem) {
            setError(problem);
            return null;
        }
        setBusy('saving');
        setError(null);
        try {
            const body = formConfigForSave(config);
            let state: FormConfigurationBuilderState;
            if (!config.id) {
                state = await formConfigClient.createDraft(body);
                const newId = state.configuration.id!;
                justCreatedRef.current = newId;
                setConfig(prev => ({ ...prev, id: newId }));
                setSavedSnapshot(snapshotOf({ ...config, id: newId }));
                setBuilderState(state);
                leaveGuard.allowNextLeave();
                navigate(`/admin/form-configurations/edit/${newId}`, { replace: true });
            } else {
                state = await formConfigClient.saveDraft(config.id, body);
                setSavedSnapshot(snapshotOf(config));
                setBuilderState(state);
            }
            setHealthRefreshToken(prev => prev + 1);
            if (!options.quiet) {
                toast.success(state.isPublished
                    ? 'Draft saved. Staff keep the published version until you publish.'
                    : 'Draft saved. Publish it when it is ready.');
            }
            return state;
        } catch (err) {
            console.error('Failed to save configuration:', err);
            const reason = apiRefusalReason(err) ?? 'The draft could not be saved. Try again.';
            setError(reason);
            toast.error(reason);
            return null;
        } finally {
            setBusy(null);
        }
    };

    const handleSave = () => void saveDraft();

    // Save and close is disabled without unsaved changes on a saved configuration (the toolbar's Save gate).
    const handleSaveAndClose = async () => {
        const state = await saveDraft();
        if (!state) return;
        leaveGuard.allowNextLeave();
        navigate(`/forms/${encodeURIComponent(state.configuration.entityTypeName)}`);
    };

    const handlePublishClick = async () => {
        const problem = publishProblem();
        if (problem) {
            setError(problem);
            toast.error(problem);
            return;
        }
        // Publish what is saved: unsaved changes are saved first.
        const state = dirty || !builderState ? await saveDraft({ quiet: true }) : builderState;
        if (!state) return;
        setPublishSummary(summarizeFormPublish(state.published, state.configuration));
        setPublishError(null);
        setPublishOpen(true);
    };

    const handleConfirmPublish = async () => {
        if (!config.id) return;
        setBusy('publishing');
        setPublishError(null);
        try {
            const published = await formConfigClient.publish(config.id);
            applyState(await formConfigClient.getBuilderState(config.id));
            setPublishOpen(false);
            setSelectedStepIndex(null);
            setHealthRefreshToken(prev => prev + 1);
            toast.success(`"${published.configurationName}" is published: staff get it from now on.`);
        } catch (err) {
            setPublishError(apiRefusalReason(err) ?? 'Publishing failed. Nothing changed for staff; try again.');
        } finally {
            setBusy(null);
        }
    };

    const handleDiscard = async () => {
        if (!config.id || !builderState?.isPublished) return;
        const ok = await confirm({
            title: 'Discard the unpublished changes?',
            message: 'The builder goes back to the published version. Your saved draft and any unsaved changes are lost.',
            confirmLabel: 'Discard',
            danger: true,
        });
        if (!ok) return;
        setBusy('discarding');
        try {
            applyState(await formConfigClient.discardDraft(config.id));
            setSelectedStepIndex(null);
            toast.success('Back to the published version.');
        } catch (err) {
            toast.error(apiRefusalReason(err) ?? 'The changes could not be discarded.');
        } finally {
            setBusy(null);
        }
    };

    const handleDuplicate = async (name: string) => {
        if (!config.id) return;
        setBusy('duplicating');
        setDuplicateError(null);
        try {
            const copy = await formConfigClient.duplicate(config.id, name);
            setDuplicateOpen(false);
            toast.success(`"${copy.configuration.configurationName}" created as a draft.`);
            navigate(`/admin/form-configurations/edit/${copy.configuration.id}`);
        } catch (err) {
            setDuplicateError(apiRefusalReason(err) ?? 'The copy could not be made.');
        } finally {
            setBusy(null);
        }
    };

    const handleGenerate = (candidates: ScaffoldCandidate[]) => {
        const steps = scaffoldFormSteps(candidates, config.steps.length);
        setScaffoldOpen(false);
        if (steps.length === 0) return;
        const fieldCount = steps.reduce((n, s) => n + s.fields.length, 0);
        setConfig(prev => ({ ...prev, steps: [...prev.steps, ...steps] }));
        setSelectedStepIndex(config.steps.length);
        toast.success(`Added ${steps.length} step${steps.length === 1 ? '' : 's'} with ${fieldCount} field${fieldCount === 1 ? '' : 's'}. Save to keep them.`);
    };

    const handleRulesChanged = () => {
        setHealthRefreshToken(prev => prev + 1);
    };

    // A new configuration marked default: name the default it would replace on Publish.
    useEffect(() => {
        if (!config.isDefault || builderState || !config.entityTypeName) {
            setDefaultConflictName(null);
            return;
        }
        let cancelled = false;
        (formConfigClient.getByEntityTypeName(config.entityTypeName, true) as Promise<FormConfigurationDto>)
            .then(existing => { if (!cancelled) setDefaultConflictName(existing?.id ? existing.configurationName : null); })
            .catch(() => { if (!cancelled) setDefaultConflictName(null); });
        return () => { cancelled = true; };
    }, [config.entityTypeName, config.isDefault, builderState]);

    const replacesDefault = config.isDefault
        ? (builderState ? builderState.currentDefaultName : defaultConflictName) ?? null
        : null;
    const entityLabel = selectedEntityMeta?.displayName || config.entityTypeName || 'the entity';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center" role="status">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-medium text-fg">Loading Configuration...</h3>
                </div>
            </div>
        );
    }

    const isPublished = builderState?.isPublished ?? false;
    const hasUnpublished = builderState?.hasUnpublishedChanges ?? false;
    const publishGate: ToolbarGate = !dirty && isPublished && !hasUnpublished
        ? { allowed: false, reason: 'Nothing to publish: the published version is up to date.' }
        : { allowed: true, reason: null };
    const duplicateGate: ToolbarGate = !config.id || !builderState
        ? { allowed: false, reason: 'Save the form first.' }
        : !isPublished
            ? { allowed: false, reason: 'Publish it first: a copy starts from the published version.' }
            : dirty ? { allowed: false, reason: 'Save or discard your changes first.' } : { allowed: true, reason: null };
    const generateGate: ToolbarGate = selectedEntityMeta
        ? { allowed: true, reason: null }
        : { allowed: false, reason: 'Choose an entity first.' };

    return (
        <div className="min-h-screen">
            <div className={`${previewOpen ? 'max-w-[100rem]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6`}>
                <BuilderToolbar
                    title={isEditMode ? 'Form builder' : 'New form'}
                    name={config.configurationName || undefined}
                    noun="form"
                    status={{
                        isNew: !config.id,
                        isPublished,
                        hasUnpublishedChanges: hasUnpublished,
                        draftSavedAt: builderState?.draftSavedAt,
                        publishedAt: builderState?.publishedAt,
                    }}
                    dirty={dirty}
                    busy={busy}
                    writeGate={writeGate}
                    publishGate={publishGate}
                    duplicateGate={duplicateGate}
                    generateGate={generateGate}
                    onSave={handleSave}
                    onSaveAndClose={() => void handleSaveAndClose()}
                    onPublish={() => void handlePublishClick()}
                    onDuplicate={() => { setDuplicateError(null); setDuplicateOpen(true); }}
                    onDiscard={() => void handleDiscard()}
                    onGenerate={() => setScaffoldOpen(true)}
                    onClose={() => void leaveGuard.confirmLeave(() => navigate(formsPagePath))}
                    previewOpen={previewOpen}
                    onTogglePreview={() => setPreviewOpen(open => !open)}
                />

                <div className={previewOpen ? 'grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]' : ''}>
                    <div className="min-w-0 space-y-6">
                        <div className="panel bg-surface">
                            {isEditMode && config.id && (
                                <div className="px-4 sm:px-6 pt-4 text-sm text-muted flex items-center gap-2">
                                    <span>Health issues detected:</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${healthIssueCount > 0 ? 'bg-warning-muted text-warning-strong' : 'bg-success-muted text-success-strong'}`}>
                                        {healthIssueCount}
                                    </span>
                                </div>
                            )}

                            <div className="px-4 sm:px-6 py-4 space-y-4">
                                {error && (
                                    <div className="rounded-md border border-danger-line bg-danger-soft p-4 flex items-start" role="alert">
                                        <AlertCircle className="h-5 w-5 text-danger mr-2 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        <p className="text-sm text-danger-strong">{error}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="form-builder-entity" className="block text-sm font-medium text-fg mb-1">
                                            Entity <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            id="form-builder-entity"
                                            value={config.entityTypeName}
                                            onChange={e => setConfig(prev => ({ ...prev, entityTypeName: e.target.value }))}
                                            disabled={isEditMode} // lock entity when editing
                                            className="input block w-full px-3 py-2 sm:text-sm"
                                        >
                                            <option value="">Select an entity...</option>
                                            {metadata.map(m => (
                                                <option key={m.entityName} value={m.entityName}>
                                                    {m.displayName} ({m.entityName})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="form-builder-name" className="block text-sm font-medium text-fg mb-1">
                                            Configuration Name <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            id="form-builder-name"
                                            type="text"
                                            value={config.configurationName}
                                            onChange={e => setConfig({ ...config, configurationName: e.target.value })}
                                            className="input block w-full px-3 py-2 sm:text-sm"
                                            placeholder={configNameSuggestion || "Select an entity first to auto-generate a name"}
                                        />
                                        {!isEditMode && configNameSuggestion && (
                                            <p className="mt-1 text-xs text-muted">
                                                Auto-generated: {configNameSuggestion} (edit to customize)
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="form-builder-description" className="block text-sm font-medium text-fg mb-1">Description</label>
                                    <textarea
                                        id="form-builder-description"
                                        value={config.description || ''}
                                        onChange={e => setConfig({ ...config, description: e.target.value })}
                                        rows={2}
                                        className="input block w-full px-3 py-2 sm:text-sm"
                                        placeholder="Optional description of this form configuration"
                                    />
                                </div>
                                <div className="rounded-md border border-info-line bg-info-soft p-3">
                                    <p className="text-xs text-info-strong">
                                        Configure <span className="font-semibold">Auto-fill Value Projection</span> per field inside the Step Field Editor.
                                        Projection rules can copy selected object values (for example from material or enchantment pickers) into other form fields,
                                        and publishing blocks circular mappings automatically.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="isDefault"
                                            checked={config.isDefault}
                                            onChange={e => {
                                                const next = e.target.checked;
                                                setConfig(prev => ({ ...prev, isDefault: next }));
                                            }}
                                            className="h-4 w-4 rounded"
                                        />
                                        <label htmlFor="isDefault" className="ml-2 block text-sm text-fg">
                                            Default form for {entityLabel} (from the next Publish)
                                        </label>
                                    </div>
                                    {replacesDefault && (
                                        <p className="mt-1 ml-6 flex items-center gap-1 text-xs text-muted">
                                            <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                            Publishing replaces "{replacesDefault}" as the default.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        {/* #71: with the preview beside it, the list and the editor sit side by side only on a wide screen. */}
                        <div className={`grid grid-cols-1 gap-6 ${previewOpen ? 'min-[1800px]:grid-cols-12' : 'lg:grid-cols-12'}`}>
                            {/* Steps Sidebar */}
                            <div className={`${previewOpen ? 'min-[1800px]:col-span-4' : 'lg:col-span-4'} panel bg-surface p-4 sm:p-6 min-w-0`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-medium text-fg">Steps</h2>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={handleAddNewStep}
                                            className="btn-secondary text-xs"
                                            title="Add new step"
                                            aria-label="Add new step"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setShowStepSelector(true)}
                                            className="btn-secondary text-xs"
                                            title="Add from template"
                                            aria-label="Add from template"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {config.steps.length === 0 ? (
                                    <div className="text-center py-8 text-muted text-sm space-y-3">
                                        <p>No steps yet. Click + to add one.</p>
                                        {selectedEntityMeta && (
                                            <button type="button" className="btn-secondary text-xs" onClick={() => setScaffoldOpen(true)}>
                                                Generate from metadata…
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleStepDragEnd}
                                    >
                                        <SortableContext
                                            items={config.steps.map(s => s.id!)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2">
                                                {config.steps.map((step, index) => (
                                                    <SortableStepItem
                                                        key={step.id}
                                                        step={step}
                                                        index={index}
                                                        isSelected={selectedStepIndex === index}
                                                        onSelect={() => setSelectedStepIndex(index)}
                                                        onDelete={() => handleDeleteStep(index)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>

                            {/* Step Editor */}
                            <div className={`${previewOpen ? 'min-[1800px]:col-span-8' : 'lg:col-span-8'} min-w-0`}>
                                {selectedStepIndex !== null && config.steps[selectedStepIndex] ? (
                                    <StepEditor
                                        step={config.steps[selectedStepIndex]}
                                        reusableFields={reusableFields}
                                        reusableSteps={reusableSteps}
                                        onUpdate={handleUpdateStep}
                                        metadataFields={selectedEntityMeta?.fields ?? []}
                                        allConfigurationFields={allFieldsInConfiguration}
                                        onRulesChanged={handleRulesChanged}
                                        entityTypeName={config.entityTypeName}
                                        formConfiguration={config}
                                        stepIndex={selectedStepIndex}
                                    />
                                ) : (
                                    <div className="panel bg-surface p-12 text-center text-muted">
                                        Select a step from the sidebar to edit it
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Configuration Health */}
                        <ConfigurationHealthPanel
                            configurationId={config.id}
                            draftConfig={config}
                            refreshToken={healthRefreshToken}
                            onIssuesLoaded={setHealthIssueCount}
                        />
                    </div>

                    {previewOpen && (
                        <aside className="min-w-0 xl:sticky xl:top-48 xl:self-start xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
                            <FormPreview config={config} entityLabel={entityLabel} />
                        </aside>
                    )}
                </div>
            </div>

            {leaveGuard.element}
            {confirmModal}

            {showStepSelector && (
                <ReusableStepSelector
                    reusableSteps={reusableSteps}
                    onSelect={handleAddReusableStep}
                    onCancel={() => setShowStepSelector(false)}
                    currentEntityType={config.entityTypeName}
                />
            )}

            <ScaffoldDialog
                open={scaffoldOpen}
                kind="form"
                meta={selectedEntityMeta}
                existing={existingFieldNames}
                onGenerate={handleGenerate}
                onClose={() => setScaffoldOpen(false)}
            />
            <DuplicateDialog
                open={duplicateOpen}
                noun="form"
                sourceName={builderState?.published?.configurationName ?? config.configurationName}
                hasUnpublishedChanges={hasUnpublished}
                duplicating={busy === 'duplicating'}
                error={duplicateError}
                onDuplicate={name => void handleDuplicate(name)}
                onClose={() => setDuplicateOpen(false)}
            />
            <PublishDialog
                open={publishOpen}
                noun="form"
                audience={`New and Edit ${entityLabel}`}
                name={config.configurationName}
                entityLabel={entityLabel}
                firstPublish={!isPublished}
                summary={publishSummary}
                replacesDefault={replacesDefault}
                openDraftCount={isPublished ? builderState?.openDraftCount ?? 0 : 0}
                publishing={busy === 'publishing'}
                error={publishError}
                onPublish={() => void handleConfirmPublish()}
                onClose={() => setPublishOpen(false)}
            />
        </div>
    );
};
