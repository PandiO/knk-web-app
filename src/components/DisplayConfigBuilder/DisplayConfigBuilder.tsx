import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, AlertCircle, Loader2, Copy, Trash2 } from 'lucide-react';
import { DisplayConfigurationDto, DisplaySectionDto, DisplayFieldDto, ReuseLinkMode } from '../../types/dtos/displayConfig/DisplayModels';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { logging } from '../../utils';
import { SectionEditor } from './SectionEditor';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSectionItem } from './SortableSectionItem';
import { FeedbackModal } from '../FeedbackModal';
import { ReusableSectionSelector } from './ReusableSectionSelector';

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
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSectionSelector, setShowSectionSelector] = useState(false);
    const [metadata, setMetadata] = useState<EntityMetadataDto[]>([]);
    const [selectedEntityMeta, setSelectedEntityMeta] = useState<EntityMetadataDto | null>(null);
    const [addingTemplate, setAddingTemplate] = useState(false);
    const [defaultConflictMsg, setDefaultConflictMsg] = useState<string | null>(null);

    type SaveFeedbackState = {
        open: boolean;
        title: string;
        message: string;
        status: 'success' | 'error' | 'info';
    };
    const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState>({
        open: false,
        title: '',
        message: '',
        status: 'info'
    });
    const autoCloseRef = useRef<number | undefined>(undefined);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const clearAutoClose = () => {
        if (autoCloseRef.current) {
            window.clearTimeout(autoCloseRef.current);
            autoCloseRef.current = undefined;
        }
    };

    useEffect(() => {
        return () => clearAutoClose();
    }, []);

    const closeSaveModal = () => {
        clearAutoClose();
        const shouldNavigate = saveFeedback.status === 'success';
        setSaveFeedback(prev => ({ ...prev, open: false }));
        if (shouldNavigate) {
            navigate('/admin/display-configurations');
        }
    };

    const handleSaveContinue = () => {
        clearAutoClose();
        setSaveFeedback(prev => ({ ...prev, open: false }));
        navigate('/admin/display-configurations');
    };

    useEffect(() => {
        loadData();
    }, [configId]);

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

    const loadData = async () => {
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

            // Only load existing config if editing
            if (isEditMode && configId && configId !== 'new') {
                const configData = await displayConfigClient.getById(parseInt(configId));
                setConfig(configData);
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            setError('Failed to load display configuration');
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.LoadFailed');
        } finally {
            setLoading(false);
        }
    };

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

    const handleAddReusableSection = async (templateSection: DisplaySectionDto, mode: ReuseLinkMode) => {
        if (!config.id) {
            // If configuration hasn't been saved yet, fall back to local cloning
            const clonedSection = cloneSection(templateSection);
            clonedSection.id = generateTempId();
            clonedSection.isLinkedToSource = mode === ReuseLinkMode.Link;

            setConfig(prev => ({
                ...prev,
                sections: [...prev.sections, clonedSection]
            }));
            setShowSectionSelector(false);
            setSelectedSectionKey(clonedSection.sectionGuid || clonedSection.id!);
            return;
        }

        // Use backend API for saved configurations
        try {
            setAddingTemplate(true);
            setError(null);

            const addedSection = await displayConfigClient.addReusableSectionToConfiguration(
                config.id,
                {
                    sourceSectionId: templateSection.id!,
                    linkMode: mode
                }
            );

            // Add the returned section to configuration
            setConfig(prev => ({
                ...prev,
                sections: [...prev.sections, addedSection]
            }));
            setShowSectionSelector(false);
            setSelectedSectionKey(addedSection.sectionGuid || addedSection.id!);
        } catch (err: any) {
            console.error('Failed to add reusable section:', err);
            const errorMsg = err?.message || 'Failed to add section from template';
            setError(errorMsg);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.AddSectionFailed');
        } finally {
            setAddingTemplate(false);
        }
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

    const validateConfig = (): boolean => {
        if (!config.entityTypeName.trim()) {
            setError('Entity name is required');
            return false;
        }

        if (!config.name.trim()) {
            setError('Configuration name is required');
            return false;
        }

        if (config.sections.length === 0) {
            setError('At least one section is required');
            return false;
        }

        for (const section of config.sections) {
            if (!section.sectionName.trim()) {
                setError(`Section must have a name`);
                return false;
            }
        }

        return true;
    };

    const handleRemoveDefault = async (existingConfig: DisplayConfigurationDto) => {
        try {
            const updatedConfig = { ...existingConfig, isDefault: false };
            await displayConfigClient.update(parseInt(updatedConfig.id!), updatedConfig);
        } catch (error) {
            console.error('Failed to unset default configuration:', error);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
        }
    };

    const handleSave = async () => {
        if (!validateConfig()) return;

        try {
            setSaving(true);
            setError(null);

            // Prepare data with ordering arrays
            const configToSave: DisplayConfigurationDto = {
                ...config,
                sectionOrderJson: JSON.stringify(config.sections.map(s => s.sectionGuid || s.id)),
                sections: config.sections.map(section => ({
                    ...section,
                    fieldOrderJson: JSON.stringify(section.fields.map(f => f.fieldGuid || f.id))
                }))
            };

            if (configToSave.isDefault) {
                try {
                    const existingDefault = await displayConfigClient.getDefaultByEntityType(config.entityTypeName, true);
                    if (existingDefault && existingDefault.id && existingDefault.id !== config.id) {
                        if (window.confirm(`There is already a default configuration for "${config.entityTypeName}". Do you want to change the default to "${config.name}"?`)) {
                            await handleRemoveDefault(existingDefault);
                        } else {
                            setSaving(false);
                            return;
                        }
                    }
                } catch (error) {
                    // No default exists, continue
                }
            }

            if (isEditMode && config.id) {
                await displayConfigClient.update(parseInt(config.id), configToSave);
            } else {
                await displayConfigClient.create(configToSave);
            }

            const successMessage = isEditMode
                ? 'Configuration updated successfully.'
                : 'Configuration created successfully.';
            setSaveFeedback({
                open: true,
                title: 'Saved',
                message: successMessage,
                status: 'success'
            });
            clearAutoClose();
            autoCloseRef.current = window.setTimeout(() => {
                handleSaveContinue();
            }, 3000);

        } catch (err: any) {
            console.error('Failed to save configuration:', err);
            
            let errorMessage = 'Failed to save configuration';
            let errorTitle = 'Save failed';
            
            if (err?.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
            setSaveFeedback({
                open: true,
                title: errorTitle,
                message: errorMessage,
                status: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const checkExistingDefault = async (entityTypeName: string, currentId?: string) => {
        if (!entityTypeName) {
            setDefaultConflictMsg(null);
            return;
        }
        try {
            const existingDefault = await displayConfigClient.getDefaultByEntityType(entityTypeName, true);
            if (existingDefault && existingDefault.id && existingDefault.id !== currentId) {
                setDefaultConflictMsg(
                    `There cannot be more than one default display configuration for "${entityTypeName}". A default already exists: "${existingDefault.name}".`
                );
            } else {
                setDefaultConflictMsg(null);
            }
        } catch {
            setDefaultConflictMsg(null);
        }
    };

    useEffect(() => {
        if (config.isDefault) {
            checkExistingDefault(config.entityTypeName, config.id);
        } else {
            setDefaultConflictMsg(null);
        }
    }, [config.entityTypeName, config.id, config.isDefault]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Loading Configuration...</h3>
                </div>
            </div>
        );
    }

    const metadataFields = selectedEntityMeta?.fields || [];

    const renderSectionList = (sections: DisplaySectionDto[], level = 0) => {
        return sections.map(section => {
            const key = section.sectionGuid || section.id!;
            const isSelected = selectedSectionKey === key;
            return (
                <div key={key} style={{ marginLeft: level * 16 }} className="flex items-center justify-between p-2 border rounded-md bg-white">
                    <button
                        className={`text-left flex-1 ${isSelected ? 'font-semibold text-primary' : 'text-gray-900'}`}
                        onClick={() => setSelectedSectionKey(key)}
                    >
                        {section.sectionName}
                        {section.isCollection && <span className="ml-2 text-xs text-blue-600">(collection)</span>}
                    </button>
                    <button
                        onClick={() => handleDeleteSection(key)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete section"
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
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white shadow-sm rounded-lg mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Display Configuration' : 'Create Display Configuration'}
                        </h1>
                    </div>

                    {config.isDefault && defaultConflictMsg && (
                        <div className="px-6 pt-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-center">
                                <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-yellow-800">{defaultConflictMsg}</span>
                            </div>
                        </div>
                    )}

                    <div className="px-6 py-4 space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                                <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Entity <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={config.entityTypeName}
                                    onChange={e => setConfig(prev => ({ ...prev, entityTypeName: e.target.value }))}
                                    disabled={isEditMode}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Configuration Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.name}
                                    onChange={e => setConfig({ ...config, name: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    placeholder="e.g., Default Display"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={config.description || ''}
                                onChange={e => setConfig({ ...config, description: e.target.value })}
                                rows={2}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                placeholder="Optional description of this display configuration"
                            />
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={config.isDefault}
                                    onChange={async e => {
                                        const next = e.target.checked;
                                        setConfig(prev => ({ ...prev, isDefault: next }));
                                        if (next) {
                                            await checkExistingDefault(config.entityTypeName, config.id);
                                        } else {
                                            setDefaultConflictMsg(null);
                                        }
                                    }}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                                <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">
                                    Set as default
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isDraft"
                                    checked={config.isDraft}
                                    onChange={e => setConfig({ ...config, isDraft: e.target.checked })}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                                <label htmlFor="isDraft" className="ml-2 block text-sm text-gray-900">
                                    Save as draft
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Sections Sidebar */}
                    <div className="col-span-4 bg-white shadow-sm rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium text-gray-900">Sections</h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleAddNewSection}
                                    className="btn-secondary text-xs"
                                    title="Add new section"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setShowSectionSelector(true)}
                                    className="btn-secondary text-xs"
                                    title="Add from template"
                                    disabled={addingTemplate}
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {config.sections.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                No sections yet. Click + to add one.
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
                                                        <div className="space-y-2 pl-4 border-l border-gray-200">
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
                    <div className="col-span-8">
                        {selectedSectionKey ? (
                            (() => {
                                const selected = findSection(config.sections, selectedSectionKey);
                                if (!selected) {
                                    return (
                                        <div className="bg-white shadow-sm rounded-lg p-12 text-center">
                                            <p className="text-gray-500">Select a section from the left to edit it.</p>
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
                            <div className="bg-white shadow-sm rounded-lg p-12 text-center">
                                <p className="text-gray-500">
                                    Select a section from the left to edit it, or create a new section.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={() => navigate('/admin/display-configurations')}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Configuration
                            </>
                        )}
                    </button>
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

            {/* Feedback Modal */}
            <FeedbackModal
                open={saveFeedback.open}
                title={saveFeedback.title}
                message={saveFeedback.message}
                status={saveFeedback.status}
                onClose={closeSaveModal}
            />
        </div>
    );
};

