import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, AlertCircle, Loader2, Copy, Trash2, Info } from 'lucide-react';
import { DisplayConfigurationBuilderState, DisplayConfigurationDto, DisplaySectionDto, DisplayFieldDto, ReuseLinkMode } from '../../types/dtos/displayConfig/DisplayModels';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { logging } from '../../utils';
import { SectionEditor } from './SectionEditor';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSectionItem } from './SortableSectionItem';
import { toast } from '../../utils/toast';
import { ReusableSectionSelector } from './ReusableSectionSelector';
import { useConfirm } from '../../hooks/useConfirm';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { CONTENT_PERMISSION_NODE } from '../../hooks/useStaffAccess';
import { useBuilderLeaveGuard } from '../../hooks/useBuilderLeaveGuard';
import { BuilderBusy, BuilderToolbar, ToolbarGate } from '../configBuilder/BuilderToolbar';
import { PublishDialog } from '../configBuilder/PublishDialog';
import { DuplicateDialog } from '../configBuilder/DuplicateDialog';
import { ScaffoldDialog } from '../configBuilder/ScaffoldDialog';
import { DisplayPreview } from '../configBuilder/DisplayPreview';
import { PublishSummary, summarizeDisplayPublish } from '../../utils/configBuilder/publishSummary';
import { displayPropertyNames, ScaffoldCandidate, scaffoldDisplaySections } from '../../utils/configBuilder/scaffold';

const WRITE_NODES = [CONTENT_PERMISSION_NODE];

/** The body the API stores: section and field order as GUID arrays (what the old Save sent). */
export function displayConfigForSave(config: DisplayConfigurationDto): DisplayConfigurationDto {
    return {
        ...config,
        sectionOrderJson: JSON.stringify(config.sections.map(s => s.sectionGuid || s.id)),
        sections: config.sections.map(section => ({
            ...section,
            fieldOrderJson: JSON.stringify(section.fields.map(f => f.fieldGuid || f.id))
        }))
    };
}

const snapshotOf = (config: DisplayConfigurationDto): string => {
    const { isDraft, hasUnpublishedChanges, draftSavedAt, publishedAt, createdAt, updatedAt, ...rest } = displayConfigForSave(config);
    return JSON.stringify(rest);
};

/**
 * The display builder (PandiO/knk-workspace#71): Save keeps the builder open and stores a draft; detail pages keep the
 * published version until Publish. Same toolbar as the form builder (Save and close, Duplicate, Generate from
 * metadata, live preview, Publish with what changes for staff).
 */
export const DisplayConfigBuilder: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const configId = id || 'new';
    const isEditMode = configId !== 'new';

    const [config, setConfig] = useState<DisplayConfigurationDto>({
        name: '',
        entityTypeName: '',
        isDefault: false,
        isDraft: true,
        sections: []
    });

    const [reusableSections, setReusableSections] = useState<DisplaySectionDto[]>([]);
    const [reusableFields, setReusableFields] = useState<DisplayFieldDto[]>([]);
    const [selectedSectionKey, setSelectedSectionKey] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(isEditMode);
    const [busy, setBusy] = useState<BuilderBusy>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSectionSelector, setShowSectionSelector] = useState(false);
    const [metadata, setMetadata] = useState<EntityMetadataDto[]>([]);
    const [selectedEntityMeta, setSelectedEntityMeta] = useState<EntityMetadataDto | null>(null);
    const [defaultConflictName, setDefaultConflictName] = useState<string | null>(null);
    const [confirm, confirmModal] = useConfirm();
    const [builderState, setBuilderState] = useState<DisplayConfigurationBuilderState | null>(null);
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [scaffoldOpen, setScaffoldOpen] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [publishOpen, setPublishOpen] = useState(false);
    const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);
    const [publishError, setPublishError] = useState<string | null>(null);
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
        ? config.sections.length > 0 || !!config.description?.trim()
        : snapshotOf(config) !== savedSnapshot;
    const leaveGuard = useBuilderLeaveGuard(dirty, `"${config.name || 'this display'}"`);

    const applyState = useCallback((state: DisplayConfigurationBuilderState) => {
        setBuilderState(state);
        setConfig(state.configuration);
        setSavedSnapshot(snapshotOf(state.configuration));
    }, []);

    // Load the reusable templates, and the config itself when editing (re-runs when the route id changes).
    useEffect(() => {
        const loadData = async () => {
            if (justCreatedRef.current && justCreatedRef.current === configId) return;
            try {
                setLoading(true);
                setError(null);

                // Always load reusable templates
                const [sectionsData, fieldsData] = await Promise.all([
                    displayConfigClient.getAllReusableSections(),
                    displayConfigClient.getAllReusableFields()
                ]);

                setReusableSections(sectionsData);
                setReusableFields(fieldsData);

                // #71: the working copy (saved draft, else the published version).
                if (isEditMode && configId && configId !== 'new') {
                    applyState(await displayConfigClient.getBuilderState(configId));
                }
            } catch (err) {
                console.error('Failed to load data:', err);
                setError(apiRefusalReason(err) ?? 'Failed to load display configuration');
                logging.errorHandler.next('ErrorMessage.DisplayConfiguration.LoadFailed');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [configId, isEditMode, applyState]);

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
                logging.errorHandler.next('ErrorMessage.DisplayConfiguration.LoadFailed');
            }
        };
        loadMeta();
    }, [configId, isEditMode]);

    useEffect(() => {
        if (config.entityTypeName) {
            const meta = metadata.find(m => m.entityName === config.entityTypeName) || null;
            setSelectedEntityMeta(meta);
        } else {
            setSelectedEntityMeta(null);
        }
    }, [config.entityTypeName, metadata]);

    useEffect(() => {
        if (!config.entityTypeName) return;
        const defaultName = `${config.entityTypeName} Display`;
        if (!config.name || config.name.trim() === '') {
            setConfig(prev => ({ ...prev, name: defaultName }));
        }
    }, [config.entityTypeName, config.name]);

    const generateTempId = () => `temp-${Date.now()}-${Math.random()}`;

    const cloneSection = (section: DisplaySectionDto): DisplaySectionDto => ({
        ...section,
        id: undefined,
        displayConfigurationId: undefined,
        sectionGuid: crypto.randomUUID?.() || `guid-${Date.now()}`,
        sourceSectionId: section.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined,
        fields: section.fields.map(f => cloneField(f)),
        subSections: section.subSections?.map(s => cloneSection(s)) || []
    });

    const cloneField = (field: DisplayFieldDto): DisplayFieldDto => ({
        ...field,
        id: undefined,
        displaySectionId: undefined,
        fieldGuid: crypto.randomUUID?.() || `guid-${Date.now()}`,
        sourceFieldId: field.id,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        compatibilityIssues: undefined
    });

    const handleAddNewSection = () => {
        const newSection: DisplaySectionDto = {
            id: generateTempId(),
            sectionGuid: crypto.randomUUID?.() || `guid-${Date.now()}`,
            sectionName: `Section ${config.sections.length + 1}`,
            description: '',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isCollection: false,
            fields: [],
            subSections: []
        };

        setConfig(prev => ({
            ...prev,
            sections: [...prev.sections, newSection]
        }));
        setSelectedSectionKey(newSection.sectionGuid || newSection.id!);
    };

    // #71: a template section is copied into the working copy (live on Publish). The API's add-from-template wrote
    // straight into the published page, so the builder no longer calls it.
    const handleAddReusableSection = (templateSection: DisplaySectionDto, mode: ReuseLinkMode) => {
        const clonedSection = cloneSection(templateSection);
        clonedSection.id = generateTempId();
        clonedSection.isLinkedToSource = mode === ReuseLinkMode.Link;

        setConfig(prev => ({
            ...prev,
            sections: [...prev.sections, clonedSection]
        }));
        setShowSectionSelector(false);
        setSelectedSectionKey(clonedSection.sectionGuid || clonedSection.id!);
    };

    const sectionMatchesKey = (s: DisplaySectionDto, key: string | number) => {
        const k = key.toString();
        return (s.sectionGuid && s.sectionGuid.toString() === k) || (s.id !== undefined && s.id?.toString() === k);
    };

    const removeSectionByKey = (sections: DisplaySectionDto[], key: string | number): DisplaySectionDto[] => {
        return sections
            .filter(s => !sectionMatchesKey(s, key))
            .map(s => ({
                ...s,
                subSections: removeSectionByKey(s.subSections || [], key)
            }));
    };

    const handleDeleteSection = (key: string | number) => {
        setConfig(prev => ({
            ...prev,
            sections: removeSectionByKey(prev.sections, key)
        }));
        if (selectedSectionKey === key) {
            setSelectedSectionKey(null);
        }
    };

    const handleSectionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setConfig(prev => {
                const oldIndex = prev.sections.findIndex(s => sectionMatchesKey(s, active.id));
                const newIndex = prev.sections.findIndex(s => sectionMatchesKey(s, over.id));

                const reorderedSections = arrayMove(prev.sections, oldIndex, newIndex);

                return { ...prev, sections: reorderedSections };
            });
        }
    };

    const replaceSection = (sections: DisplaySectionDto[], updated: DisplaySectionDto): DisplaySectionDto[] => {
        return sections.map(s => {
            if (sectionMatchesKey(s, updated.sectionGuid || updated.id!)) {
                return updated;
            }
            return { ...s, subSections: replaceSection(s.subSections || [], updated) };
        });
    };

    const handleUpdateSection = (updatedSection: DisplaySectionDto) => {
        setConfig(prev => ({
            ...prev,
            sections: replaceSection(prev.sections, updatedSection)
        }));
    };

    const findSection = (sections: DisplaySectionDto[], key: string | number): DisplaySectionDto | null => {
        for (const s of sections) {
            if (sectionMatchesKey(s, key)) return s;
            const child = findSection(s.subSections || [], key);
            if (child) return child;
        }
        return null;
    };

    const handleAddChildSection = (parentKey: string | number) => {
        const newSection: DisplaySectionDto = {
            id: generateTempId(),
            sectionGuid: crypto.randomUUID?.() || `guid-${Date.now()}`,
            sectionName: 'Item Template',
            description: '',
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isCollection: false,
            fields: [],
            subSections: [],
            parentSectionId: parentKey as any // stored for backend when saved
        } as DisplaySectionDto;

        const addChild = (sections: DisplaySectionDto[]): DisplaySectionDto[] =>
            sections.map(s => {
                if (sectionMatchesKey(s, parentKey)) {
                    const subSections = [...(s.subSections || []), newSection];
                    return { ...s, subSections };
                }
                return { ...s, subSections: addChild(s.subSections || []) };
            });

        setConfig(prev => ({
            ...prev,
            sections: addChild(prev.sections)
        }));
        setSelectedSectionKey(newSection.sectionGuid || newSection.id!);
    };

    const draftProblem = (): string | null => {
        if (!config.entityTypeName.trim()) return 'Choose an entity first.';
        if (!config.name.trim()) return 'Give the configuration a name.';
        return null;
    };

    /** What the old Save checked; detail pages need a finished page, so Publish needs it. */
    const publishProblem = (): string | null => {
        const draft = draftProblem();
        if (draft) return draft;
        if (config.sections.length === 0) return 'At least one section is required.';
        if (config.sections.some(section => !section.sectionName.trim())) return 'Every section needs a name.';
        return null;
    };

    const saveDraft = async (options: { quiet?: boolean } = {}): Promise<DisplayConfigurationBuilderState | null> => {
        const problem = draftProblem();
        if (problem) {
            setError(problem);
            return null;
        }
        setBusy('saving');
        setError(null);
        try {
            const body = displayConfigForSave(config);
            let state: DisplayConfigurationBuilderState;
            if (!config.id) {
                state = await displayConfigClient.createDraft(body);
                const newId = state.configuration.id!;
                justCreatedRef.current = newId;
                setConfig(prev => ({ ...prev, id: newId, configurationGuid: state.configuration.configurationGuid }));
                setSavedSnapshot(snapshotOf({ ...config, id: newId, configurationGuid: state.configuration.configurationGuid }));
                setBuilderState(state);
                leaveGuard.allowNextLeave();
                navigate(`/admin/display-configurations/edit/${newId}`, { replace: true });
            } else {
                state = await displayConfigClient.saveDraft(config.id, body);
                setSavedSnapshot(snapshotOf(config));
                setBuilderState(state);
            }
            if (!options.quiet) {
                toast.success(state.isPublished
                    ? 'Draft saved. Detail pages keep the published version until you publish.'
                    : 'Draft saved. Publish it when it is ready.');
            }
            return state;
        } catch (err) {
            console.error('Failed to save configuration:', err);
            const reason = apiRefusalReason(err) ?? 'The draft could not be saved. Try again.';
            setError(reason);
            toast.error(reason);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
            return null;
        } finally {
            setBusy(null);
        }
    };

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
        const state = dirty || !builderState ? await saveDraft({ quiet: true }) : builderState;
        if (!state) return;
        setPublishSummary(summarizeDisplayPublish(state.published, state.configuration));
        setPublishError(null);
        setPublishOpen(true);
    };

    const handleConfirmPublish = async () => {
        if (!config.id) return;
        setBusy('publishing');
        setPublishError(null);
        try {
            const published = await displayConfigClient.publish(parseInt(config.id, 10));
            applyState(await displayConfigClient.getBuilderState(config.id));
            setPublishOpen(false);
            setSelectedSectionKey(null);
            toast.success(`"${published.name}" is published: detail pages show it from now on.`);
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
            applyState(await displayConfigClient.discardDraft(config.id));
            setSelectedSectionKey(null);
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
            const copy = await displayConfigClient.duplicate(config.id, name);
            setDuplicateOpen(false);
            toast.success(`"${copy.configuration.name}" created as a draft.`);
            navigate(`/admin/display-configurations/edit/${copy.configuration.id}`);
        } catch (err) {
            setDuplicateError(apiRefusalReason(err) ?? 'The copy could not be made.');
        } finally {
            setBusy(null);
        }
    };

    const metadataFor = useCallback((type: string) => metadata.find(m => m.entityName === type), [metadata]);
    const existingProperties = useMemo(() => displayPropertyNames(config.sections), [config.sections]);

    const handleGenerate = (candidates: ScaffoldCandidate[]) => {
        const sections = scaffoldDisplaySections(candidates, metadataFor);
        setScaffoldOpen(false);
        if (sections.length === 0) return;
        const fieldCount = sections.reduce((n, s) => n + s.fields.length, 0);
        setConfig(prev => ({ ...prev, sections: [...prev.sections, ...sections] }));
        setSelectedSectionKey(sections[0].sectionGuid || sections[0].id!);
        toast.success(`Added ${sections.length} section${sections.length === 1 ? '' : 's'} with ${fieldCount} field${fieldCount === 1 ? '' : 's'}. Save to keep them.`);
    };

    // A new configuration marked default: name the default it would replace on Publish.
    useEffect(() => {
        if (!config.isDefault || builderState || !config.entityTypeName) {
            setDefaultConflictName(null);
            return;
        }
        let cancelled = false;
        displayConfigClient.getDefaultByEntityType(config.entityTypeName, false)
            .then(existing => { if (!cancelled) setDefaultConflictName(existing?.id ? existing.name : null); })
            .catch(() => { if (!cancelled) setDefaultConflictName(null); });
        return () => { cancelled = true; };
    }, [config.entityTypeName, config.isDefault, builderState]);

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

    const metadataFields = selectedEntityMeta?.fields || [];
    const entityLabel = selectedEntityMeta?.displayName || config.entityTypeName || 'the entity';
    const isPublished = builderState?.isPublished ?? false;
    const hasUnpublished = builderState?.hasUnpublishedChanges ?? false;
    const replacesDefault = config.isDefault
        ? (builderState ? builderState.currentDefaultName : defaultConflictName) ?? null
        : null;
    const publishGate: ToolbarGate = !dirty && isPublished && !hasUnpublished
        ? { allowed: false, reason: 'Nothing to publish: the published version is up to date.' }
        : { allowed: true, reason: null };
    const duplicateGate: ToolbarGate = !config.id || !builderState
        ? { allowed: false, reason: 'Save the display first.' }
        : !isPublished
            ? { allowed: false, reason: 'Publish it first: a copy starts from the published version.' }
            : dirty ? { allowed: false, reason: 'Save or discard your changes first.' } : { allowed: true, reason: null };
    const generateGate: ToolbarGate = selectedEntityMeta
        ? { allowed: true, reason: null }
        : { allowed: false, reason: 'Choose an entity first.' };

    const renderSectionList = (sections: DisplaySectionDto[], level = 0) => {
        return sections.map(section => {
            const key = section.sectionGuid || section.id!;
            const isSelected = selectedSectionKey === key;
            return (
                <div key={key} style={{ marginLeft: level * 16 }} className="flex flex-wrap items-center justify-between p-2 border border-line rounded-md bg-surface">
                    <button
                        className={`text-left flex-1 min-w-0 ${isSelected ? 'font-semibold text-primary' : 'text-fg'}`}
                        onClick={() => setSelectedSectionKey(key)}
                    >
                        {section.sectionName}
                        {section.isCollection && <span className="ml-2 text-xs text-info-strong">(collection)</span>}
                    </button>
                    <button
                        onClick={() => handleDeleteSection(key)}
                        className="p-1 text-muted hover:text-danger"
                        title="Delete section"
                        aria-label={`Delete section ${section.sectionName}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                    {section.subSections && section.subSections.length > 0 && (
                        <div className="w-full mt-2">{renderSectionList(section.subSections, level + 1)}</div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="min-h-screen">
            <div className={`${previewOpen ? 'max-w-[100rem]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6`}>
                <BuilderToolbar
                    title={isEditMode ? 'Display builder' : 'New display'}
                    name={config.name || undefined}
                    noun="display"
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
                    onSave={() => void saveDraft()}
                    onSaveAndClose={() => void handleSaveAndClose()}
                    onPublish={() => void handlePublishClick()}
                    onDuplicate={() => { setDuplicateError(null); setDuplicateOpen(true); }}
                    onDiscard={() => void handleDiscard()}
                    onGenerate={() => setScaffoldOpen(true)}
                    onClose={() => void leaveGuard.confirmLeave(() => navigate(formsPagePath))}
                    previewOpen={previewOpen}
                    onTogglePreview={() => setPreviewOpen(open => !open)}
                />

                <div className={previewOpen ? 'grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,36rem)]' : ''}>
                    <div className="min-w-0 space-y-6">
                        <div className="panel bg-surface">
                            <div className="px-4 sm:px-6 py-4 space-y-4">
                                {error && (
                                    <div className="rounded-md border border-danger-line bg-danger-soft p-4 flex items-start" role="alert">
                                        <AlertCircle className="h-5 w-5 text-danger mr-2 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                        <p className="text-sm text-danger-strong">{error}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="display-builder-entity" className="block text-sm font-medium text-fg mb-1">
                                            Entity <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            id="display-builder-entity"
                                            value={config.entityTypeName}
                                            onChange={e => setConfig(prev => ({ ...prev, entityTypeName: e.target.value }))}
                                            disabled={isEditMode}
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
                                        <label htmlFor="display-builder-name" className="block text-sm font-medium text-fg mb-1">
                                            Configuration Name <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            id="display-builder-name"
                                            type="text"
                                            value={config.name}
                                            onChange={e => setConfig({ ...config, name: e.target.value })}
                                            className="input block w-full px-3 py-2 sm:text-sm"
                                            placeholder="e.g., Default Display"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="display-builder-description" className="block text-sm font-medium text-fg mb-1">Description</label>
                                    <textarea
                                        id="display-builder-description"
                                        value={config.description || ''}
                                        onChange={e => setConfig({ ...config, description: e.target.value })}
                                        rows={2}
                                        className="input block w-full px-3 py-2 sm:text-sm"
                                        placeholder="Optional description of this display configuration"
                                    />
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
                                            Default display for {entityLabel} (from the next Publish)
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
                            {/* Sections Sidebar */}
                            <div className={`${previewOpen ? 'min-[1800px]:col-span-4' : 'lg:col-span-4'} panel bg-surface p-4 sm:p-6 min-w-0`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-medium text-fg">Sections</h2>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={handleAddNewSection}
                                            className="btn-secondary text-xs"
                                            title="Add new section"
                                            aria-label="Add new section"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setShowSectionSelector(true)}
                                            className="btn-secondary text-xs"
                                            title="Add from template"
                                            aria-label="Add from template"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {config.sections.length === 0 ? (
                                    <div className="text-center py-8 text-muted text-sm space-y-3">
                                        <p>No sections yet. Click + to add one.</p>
                                        {selectedEntityMeta && (
                                            <button type="button" className="btn-secondary text-xs" onClick={() => setScaffoldOpen(true)}>
                                                Generate from metadata…
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Keep drag-and-drop for top-level only */}
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleSectionDragEnd}
                                        >
                                            <SortableContext
                                                items={config.sections.map(s => s.sectionGuid || s.id!)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {config.sections.map((section, index) => {
                                                    const key = section.sectionGuid || section.id!;
                                                    const isSelected = selectedSectionKey === key;
                                                    return (
                                                        <div key={key} className="space-y-2">
                                                            <SortableSectionItem
                                                                section={section}
                                                                index={index}
                                                                isSelected={isSelected}
                                                                onSelect={() => setSelectedSectionKey(key)}
                                                                onDelete={() => handleDeleteSection(key)}
                                                            />
                                                            {/* Render child sections (non-draggable) */}
                                                            {section.subSections && section.subSections.length > 0 && (
                                                                <div className="space-y-2 pl-4 border-l border-line">
                                                                    {renderSectionList(section.subSections, 1)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                )}
                            </div>

                            {/* Section Editor */}
                            <div className={`${previewOpen ? 'min-[1800px]:col-span-8' : 'lg:col-span-8'} min-w-0`}>
                                {selectedSectionKey ? (
                                    (() => {
                                        const selected = findSection(config.sections, selectedSectionKey);
                                        if (!selected) {
                                            return (
                                                <div className="panel bg-surface p-12 text-center">
                                                    <p className="text-muted">Select a section from the left to edit it.</p>
                                                </div>
                                            );
                                        }
                                        return (
                                            <SectionEditor
                                                section={selected}
                                                reusableFields={reusableFields}
                                                onUpdate={handleUpdateSection}
                                                onAddChildSection={handleAddChildSection}
                                                metadataFields={metadataFields}
                                            />
                                        );
                                    })()
                                ) : (
                                    <div className="panel bg-surface p-12 text-center">
                                        <p className="text-muted">
                                            Select a section from the left to edit it, or create a new section.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {previewOpen && (
                        <aside className="min-w-0 xl:sticky xl:top-48 xl:self-start xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
                            <DisplayPreview config={config} entityLabel={entityLabel} />
                        </aside>
                    )}
                </div>
            </div>

            {/* Reusable Section Selector Modal */}
            {showSectionSelector && (
                <ReusableSectionSelector
                    reusableSections={reusableSections}
                    onSelect={handleAddReusableSection}
                    onCancel={() => setShowSectionSelector(false)}
                    currentEntityType={config.entityTypeName}
                />
            )}

            <ScaffoldDialog
                open={scaffoldOpen}
                kind="display"
                meta={selectedEntityMeta}
                existing={existingProperties}
                onGenerate={handleGenerate}
                onClose={() => setScaffoldOpen(false)}
            />
            <DuplicateDialog
                open={duplicateOpen}
                noun="display"
                sourceName={builderState?.published?.name ?? config.name}
                hasUnpublishedChanges={hasUnpublished}
                duplicating={busy === 'duplicating'}
                error={duplicateError}
                onDuplicate={name => void handleDuplicate(name)}
                onClose={() => setDuplicateOpen(false)}
            />
            <PublishDialog
                open={publishOpen}
                noun="display"
                audience={`${entityLabel} detail pages`}
                name={config.name}
                entityLabel={entityLabel}
                firstPublish={!isPublished}
                summary={publishSummary}
                replacesDefault={replacesDefault}
                publishing={busy === 'publishing'}
                error={publishError}
                onPublish={() => void handleConfirmPublish()}
                onClose={() => setPublishOpen(false)}
            />
            {leaveGuard.element}
            {confirmModal}
        </div>
    );
};
