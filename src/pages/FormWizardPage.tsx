import { GripVertical, Loader2, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { displayConfigClient } from '../apiClients/displayConfigClient';
import { formConfigClient } from '../apiClients/formConfigClient';
import { formSubmissionClient } from '../apiClients/formSubmissionClient';
import { FeedbackModal } from '../components/FeedbackModal';
import { DisplayConfigurationTable } from '../components/FormWizard/DisplayConfigurationTable';
import { EntityMetadataNavigator } from '../components/FormWizard/EntityMetadataNavigator';
import { FormConfigurationTable } from '../components/FormWizard/FormConfigurationTable';
import { FormWizard } from '../components/FormWizard/FormWizard';
import { SavedProgressList } from '../components/FormWizard/SavedProgressList';
import { workflowClient } from '../apiClients/workflowClient';
import ObjectTypeExplorer from '../components/ObjectTypeExplorer';
import { columnDefinitionsRegistry, defaultColumnDefinitions } from '../config/objectConfigs';
import { EntityMetadataDto } from '../types/dtos/metadata/MetadataModels';
import { logging } from '../utils';
import { FormConfigurationDto, FormSubmissionProgressDto, FormSubmissionProgressSummaryDto } from '../types/dtos/forms/FormModels';
import { DisplayConfigurationDto } from '../types/dtos/displayConfig/DisplayModels';
import { useEntityMetadata } from '../hooks/useEntityMetadata';
import { getCreateFunctionForEntity, getFetchByIdFunctionForEntity, getUpdateFunctionForEntity } from '../utils/entityApiMapping';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { 
    entityTypeName: string; 
    objectTypes: ObjectType[]; 
    entityId?: string;
    entityMetadataFromApp?: EntityMetadataDto[];
    // added: explicit prop to control auto-opening of default form
    autoOpenDefaultForm?: boolean;
};

// changed: destructure new prop with default value
export const FormWizardPage: React.FC<Props> = ({ 
    entityTypeName: typeName, 
    objectTypes, 
    entityId: propsEntityId,
    entityMetadataFromApp,
    autoOpenDefaultForm = false 
}: Props) => {
    const navigate = useNavigate();
    const { entityName, entityId: urlEntityId } = useParams<{ entityName: string; entityId?: string }>();
    // added: read query parameter for auto-open and parent context for child entity creation
    const [searchParams] = useSearchParams();
    
    // Prioritize URL params over props
    const entityId = urlEntityId || propsEntityId;
    const selectedTypeName = entityName || typeName || '';
    
    // added: read parent context for child entity creation workflow
    const parentEntityTypeName = searchParams.get('parentEntityTypeName');
    const parentEntityId = searchParams.get('parentEntityId');
    const relationshipFieldName = searchParams.get('relationshipFieldName');
    
    // changed: check both prop and query parameter for auto-open
    const shouldAutoOpen = autoOpenDefaultForm || searchParams.get('autoOpen') === 'true';

    const selectedObjectType = useMemo(() => objectTypes.find(ot => ot.id === selectedTypeName) || null, [objectTypes, selectedTypeName]);
    
    const [formConfigs, setFormConfigs] = useState<FormConfigurationDto[]>([]);
    const [defaultConfig, setDefaultConfig] = useState<FormConfigurationDto | null>(null);
    const [savedProgress, setSavedProgress] = useState<FormSubmissionProgressSummaryDto[]>([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);
    const [displayConfigs, setDisplayConfigs] = useState<DisplayConfigurationDto[]>([]);
    const [loadingDisplayConfigs, setLoadingDisplayConfigs] = useState(false);
    
    // State to track if FormWizard should be shown
    const [showWizard, setShowWizard] = useState(false);
    const [wizardConfig, setWizardConfig] = useState<FormConfigurationDto | null>(null);
    const [wizardProgressId, setWizardProgressId] = useState<string | undefined>(undefined);
    const [workflowSessionId, setWorkflowSessionId] = useState<number | undefined>(undefined);
    const [autoOpenForm, setAutoOpenForm] = useState(false); // removed: old auto-open flag logic
    const [columnDraft, setColumnDraft] = useState<string[]>([]);
    const [savingColumns, setSavingColumns] = useState(false);

    const columnSensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    type FeedbackState = {
        open: boolean;
        title: string;
        message: string;
        status: 'success' | 'error' | 'info';
        onContinue?: () => void;
        autoCloseMs?: number;
    };
    const [feedbackModal, setFeedbackModal] = useState<FeedbackState>({
        open: false,
        title: '',
        message: '',
        status: 'info',
        onContinue: undefined,
        autoCloseMs: undefined,
    });

    const showFeedback = (payload: Omit<FeedbackState, 'open'>) => {
        setFeedbackModal({ ...payload, open: true });
    };

    const closeFeedbackModal = () => {
        setFeedbackModal(prev => ({ ...prev, open: false, onContinue: undefined }));
    };

    const handleFeedbackContinue = () => {
        const action = feedbackModal.onContinue;
        closeFeedbackModal();
        action?.();
    };

    const userId = '1'; // TODO: Get from auth context

    // Load merged metadata for UI context and selection display
    const {
        allMergedMetadata,
        baseMetadata,
        configurations,
        loading: metadataLoading,
        createConfiguration,
        updateConfiguration,
        refresh,
    } = useEntityMetadata();

    const resolvedBaseMetadata = useMemo(() => {
        return (entityMetadataFromApp && entityMetadataFromApp.length > 0)
            ? entityMetadataFromApp
            : baseMetadata;
    }, [entityMetadataFromApp, baseMetadata]);

    const selectedEntityMetadata = useMemo(() => {
        if (!selectedTypeName) {
            return null;
        }

        return (
            allMergedMetadata.find(meta => meta.entityName.toLowerCase() === selectedTypeName.toLowerCase()) ||
            resolvedBaseMetadata.find(meta => meta.entityName.toLowerCase() === selectedTypeName.toLowerCase()) ||
            null
        );
    }, [allMergedMetadata, resolvedBaseMetadata, selectedTypeName]);

    const configuredColumns = useMemo(() => {
        return selectedEntityMetadata?.defaultTableColumns ?? [];
    }, [selectedEntityMetadata]);

    const availableColumns = useMemo(() => {
        if (!selectedTypeName) {
            return [] as Array<{ key: string; label: string }>;
        }

        const normalizedType = selectedTypeName.toLowerCase();
        const registryColumns = (
            columnDefinitionsRegistry[normalizedType]?.default ||
            defaultColumnDefinitions.default
        ).map(column => ({ key: column.key, label: column.label }));

        const metadataColumns = [
            ...(selectedEntityMetadata?.fields || []).map(field => ({ key: field.fieldName, label: toLabel(field.fieldName) })),
            ...(selectedEntityMetadata?.properties || []).map(prop => ({ key: prop.name, label: toLabel(prop.name) })),
        ];

        const merged = [...registryColumns, ...metadataColumns];
        const unique = new Map<string, { key: string; label: string }>();
        merged.forEach(column => {
            const normalized = column.key.toLowerCase();
            if (!unique.has(normalized)) {
                unique.set(normalized, column);
            }
        });

        return Array.from(unique.values());
    }, [selectedTypeName, selectedEntityMetadata]);

    const canonicalizeColumnKeys = React.useCallback((columns: string[]): string[] => {
        if (columns.length === 0) {
            return [];
        }

        const availableByLower = new Map<string, string>();
        availableColumns.forEach(column => {
            availableByLower.set(column.key.toLowerCase(), column.key);
        });

        return columns
            .map(key => {
                const normalized = key.trim();
                if (!normalized) {
                    return '';
                }

                return availableByLower.get(normalized.toLowerCase()) || normalized;
            })
            .filter(Boolean)
            .filter((key, index, array) => array.findIndex(entry => entry.toLowerCase() === key.toLowerCase()) === index);
    }, [availableColumns]);

    useEffect(() => {
        if (!selectedTypeName) {
            setColumnDraft([]);
            return;
        }

        if (configuredColumns.length > 0) {
            const guarded = applyNameDisplayNameGuard(configuredColumns, selectedEntityMetadata);
            setColumnDraft(canonicalizeColumnKeys(guarded));
            return;
        }

        const normalizedType = selectedTypeName.toLowerCase();
        const fallback = (
            columnDefinitionsRegistry[normalizedType]?.default ||
            defaultColumnDefinitions.default
        ).map(column => column.key);
        const guardedFallback = applyNameDisplayNameGuard(fallback, selectedEntityMetadata);
        setColumnDraft(canonicalizeColumnKeys(guardedFallback));
    }, [selectedTypeName, configuredColumns, selectedEntityMetadata, canonicalizeColumnKeys]);

    // Main effect: Handle the four use cases
    useEffect(() => {
        // Use Case 3: No entity selected
        if (!selectedTypeName) {
            setShowWizard(false);
            setFormConfigs([]);
            setSavedProgress([]);
            setDefaultConfig(null);
            setAutoOpenForm(false);
            return;
        }

        // Use Case 1: Entity ID provided (edit mode)
        if (entityId) {
            loadDefaultConfigForEdit(selectedTypeName);
            setAutoOpenForm(false);
            return;
        }

        // changed: Use Case 4 detection uses both prop and query param
        setAutoOpenForm(shouldAutoOpen && !!selectedTypeName && !urlEntityId);

        // Use Case 2 or 4: Only entity name provided
        loadConfigurationsAndProgress(selectedTypeName);
    }, [selectedTypeName, entityId, shouldAutoOpen, urlEntityId]);

    // added: Auto-open default form when configurations are loaded (Use Case 4)
    useEffect(() => {
        const tryOpen = async () => {
            console.log('Auto-open effect triggered:', { autoOpenForm, defaultConfig: defaultConfig?.id, wizardConfig: wizardConfig?.id, showWizard, loadingConfigs });
            // Only auto-open if:
            // 1. Auto-open flag is set
            // 2. Default config exists
            // 3. Wizard is not already shown
            // 4. Not currently loading
            // 5. No manual config selection has been made (wizardConfig is null)
            if (autoOpenForm && defaultConfig && !showWizard && !loadingConfigs && !wizardConfig) {
                // Clear the flag immediately to prevent re-triggering
                setAutoOpenForm(false);
                setWizardConfig(defaultConfig);
                setWizardProgressId(undefined);
                try {
                    const cfgIdNum = defaultConfig.id ? parseInt(String(defaultConfig.id), 10) : undefined;
                    const entityIdNum = entityId ? parseInt(String(entityId), 10) : undefined;
                    const session = await workflowClient.createSession({
                        userId: parseInt(userId, 10) || 0,
                        formConfigurationId: cfgIdNum,
                        entityTypeName: selectedTypeName,
                        entityId: entityIdNum
                    });
                    setWorkflowSessionId(session.id);
                } catch {
                    setWorkflowSessionId(undefined);
                }
                setShowWizard(true);
            }
        };
        void tryOpen();
    }, [autoOpenForm, defaultConfig, loadingConfigs, wizardConfig, entityId, selectedTypeName, userId]);

    useEffect(() => {
        if (!selectedTypeName) {
            setDisplayConfigs([]);
            return;
        }
        loadDisplayConfigurations(selectedTypeName);
    }, [selectedTypeName]);

    // Use Case 1: Load default config for editing an existing entity
    const loadDefaultConfigForEdit = async (entityTypeName: string) => {
        try {
            setLoadingConfigs(true);
            setShowWizard(false);

            // Fetch all configurations to find the default
            const configs = await formConfigClient.getByEntityTypeName(entityTypeName, false) as FormConfigurationDto[];
            setFormConfigs(configs);

            // Find default configuration
            const defaultCfg = configs.find(c => c.isDefault) || configs[0];
            
            if (!defaultCfg) {
                logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
                return;
            }

            setDefaultConfig(defaultCfg);
            setWizardConfig(defaultCfg);
            setWizardProgressId(undefined);
            try {
                    const cfgIdNum = defaultCfg.id ? parseInt(String(defaultCfg.id), 10) : undefined;
                    const entityIdNum = entityId ? parseInt(String(entityId), 10) : undefined;
                    const session = await workflowClient.createSession({
                        userId: parseInt(userId, 10) || 0,
                        formConfigurationId: cfgIdNum,
                        entityTypeName: selectedTypeName,
                        entityId: entityIdNum
                    });
                    setWorkflowSessionId(session.id);
                } catch {
                    setWorkflowSessionId(undefined);
                }
            setShowWizard(true);
        } catch (error) {
            console.error('Failed to load configuration for edit:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
        } finally {
            setLoadingConfigs(false);
        }
    };

    // Use Case 2: Load configurations and saved progress for entity
    const loadConfigurationsAndProgress = async (entityTypeName: string) => {
        try {
            setLoadingConfigs(true);
            setShowWizard(false);
            setWizardConfig(null); // Clear any previously selected config

            // Fetch all configurations
            const configs = await formConfigClient.getByEntityTypeName(entityTypeName, false) as FormConfigurationDto[];
            const sortedConfigs = [...configs].sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                return 0;
            });
            setFormConfigs(sortedConfigs);
            setDefaultConfig(sortedConfigs.find(c => c.isDefault) || null);

            // Fetch saved progress
            const progress = await formSubmissionClient.getByEntityTypeName(entityTypeName, userId, true) as FormSubmissionProgressSummaryDto[];
            const entityProgress = progress.filter(p => 
                p.entityTypeName?.toLowerCase() === entityTypeName.toLowerCase()
            );
            setSavedProgress(entityProgress);
        } catch (error) {
            console.error('Failed to fetch configurations or progress:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
        } finally {
            setLoadingConfigs(false);
        }
    };

    const loadDisplayConfigurations = async (entityTypeName: string) => {
        if (!entityTypeName) {
            setDisplayConfigs([]);
            return;
        }
        try {
            setLoadingDisplayConfigs(true);
            const configs = await displayConfigClient.getAll(true);
            const filtered = configs
                .filter(cfg => (cfg.entityTypeName || '').toLowerCase() === entityTypeName.toLowerCase())
                .sort((a, b) => {
                    if (a.isDefault && !b.isDefault) return -1;
                    if (!a.isDefault && b.isDefault) return 1;
                    return 0;
                });
            setDisplayConfigs(filtered);
        } catch (error) {
            console.error('Failed to fetch display configurations:', error);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.LoadFailed');
        } finally {
            setLoadingDisplayConfigs(false);
        }
    };

    // Handler: Open wizard with specific configuration
    const handleOpenConfiguration = async (config: FormConfigurationDto, progressId?: string) => {
        console.log('Opening wizard with configuration:', config, 'and progressId:', progressId);
        setAutoOpenForm(false); // Clear auto-open flag to prevent default config from overriding
        setWizardConfig(config);
        setWizardProgressId(progressId);
        try {
            const cfgIdNum = config.id ? parseInt(String(config.id), 10) : undefined;
            const entityIdNum = entityId ? parseInt(String(entityId), 10) : undefined;
            const session = await workflowClient.createSession({
                userId: parseInt(userId, 10) || 0,
                formConfigurationId: cfgIdNum,
                entityTypeName: selectedTypeName,
                entityId: entityIdNum
            });
            setWorkflowSessionId(session.id);
        } catch (error) {
            console.error('Failed to create workflow session', error);
            setWorkflowSessionId(undefined);
        }
        setShowWizard(true);
    };

    // Handler: Set default configuration
    const handleSetDefault = async (config: FormConfigurationDto) => {
        const existingDefault = formConfigs.find(c => c.id !== config.id && c.isDefault);
        
        if (existingDefault) {
            if (!window.confirm(`There is already a default configuration for "${selectedTypeName}". Do you want to change the default to "${config.configurationName}"?`)) {
                return;
            }
            await handleRemoveDefault(existingDefault);
        }

        try {
            const updatedConfig = { ...config, isDefault: true };
            await formConfigClient.update(updatedConfig);
            await loadConfigurationsAndProgress(selectedTypeName);
        } catch (error) {
            console.error('Failed to set default configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
        }
    };

    // Handler: Remove default status
    const handleRemoveDefault = async (config: FormConfigurationDto) => {
        try {
            const updatedConfig = { ...config, isDefault: false };
            await formConfigClient.update(updatedConfig);
            await loadConfigurationsAndProgress(selectedTypeName);
        } catch (error) {
            console.error('Failed to remove default configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
        }
    };

    // Handler: Edit configuration
    const handleEditConfiguration = (config: FormConfigurationDto) => {
        console.log('Navigating to edit configuration:', config);
        navigate(`/admin/form-configurations/edit/${config.id}`);
    };

    // Handler: Resume progress
    const handleResumeProgress = async (progress: FormSubmissionProgressSummaryDto) => {
        try {
            const fullProgress = await formSubmissionClient.getById(progress.id!);
            const config = formConfigs.find(c => c.id === fullProgress.formConfigurationId);
            
            if (config) {
                handleOpenConfiguration(config, fullProgress.id);
            }
        } catch (error) {
            console.error('Failed to resume progress:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.LoadFailed');
        }
    };

    // Handler: Delete progress
    const handleDeleteProgress = async (progress: FormSubmissionProgressSummaryDto) => {
        if (!window.confirm('Are you sure you want to delete this saved progress?')) return;

        try {
            await formSubmissionClient.delete(progress.id!);
            setSavedProgress(prev => prev.filter(p => p.id !== progress.id));
            showFeedback({
                title: 'Progress deleted',
                message: 'The saved progress has been removed.',
                status: 'success',
                onContinue: undefined,
                autoCloseMs: 3000,
            });
        } catch (error) {
            console.error('Failed to delete progress:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.DeleteFailed');
            showFeedback({
                title: 'Delete failed',
                message: 'Unable to delete the saved progress. Please try again.',
                status: 'error',
                onContinue: undefined,
            });
        }
    };

    // Handler: Delete configuration
    const handleFormConfigDelete = async (config: FormConfigurationDto) => {
        if (!window.confirm('Are you sure you want to delete this form configuration?')) return;

        try {
            await formConfigClient.delete(config.id!);
            setFormConfigs(prev => prev.filter(c => c.id !== config.id));
            showFeedback({
                title: 'Configuration deleted',
                message: 'The form configuration has been removed.',
                status: 'success',
                onContinue: undefined,
                autoCloseMs: 3000,
            });
        } catch (error) {
            console.error('Failed to delete configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.DeleteFailed');
            showFeedback({
                title: 'Delete failed',
                message: 'Unable to delete the form configuration. Please try again.',
                status: 'error',
                onContinue: undefined,
            });
        }
    };

    const handleDisplaySetDefault = async (config: DisplayConfigurationDto) => {
        const idNumber = config.id ? parseInt(config.id, 10) : NaN;
        if (Number.isNaN(idNumber)) {
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
            return;
        }

        const existingDefault = displayConfigs.find(c => c.id !== config.id && c.isDefault);
        if (existingDefault) {
            if (!window.confirm(`There is already a default display configuration for "${selectedTypeName}". Change default to "${config.name}"?`)) {
                return;
            }
            await handleDisplayRemoveDefault(existingDefault);
        }

        try {
            await displayConfigClient.update(idNumber, { ...config, isDefault: true });
            await loadDisplayConfigurations(selectedTypeName);
        } catch (error) {
            console.error('Failed to set default display configuration:', error);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
        }
    };

    const handleDisplayRemoveDefault = async (config: DisplayConfigurationDto) => {
        const idNumber = config.id ? parseInt(config.id, 10) : NaN;
        if (Number.isNaN(idNumber)) {
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
            return;
        }
        try {
            await displayConfigClient.update(idNumber, { ...config, isDefault: false });
            await loadDisplayConfigurations(selectedTypeName);
        } catch (error) {
            console.error('Failed to remove default display configuration:', error);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.SaveFailed');
        }
    };

    const handleDisplayEdit = (config: DisplayConfigurationDto) => {
        if (!config.id) {
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.LoadFailed');
            return;
        }
        navigate(`/admin/display-configurations/edit/${config.id}`);
    };

    const handleDisplayPublish = async (config: DisplayConfigurationDto) => {
        const idNumber = config.id ? parseInt(config.id, 10) : NaN;
        if (Number.isNaN(idNumber)) {
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.PublishFailed');
            return;
        }
        try {
            const published = await displayConfigClient.publish(idNumber);
            setDisplayConfigs(prev => prev.map(c => c.id === config.id ? published : c));
            showFeedback({
                title: 'Display configuration published',
                message: `"${config.name}" is now live and available for use.`,
                status: 'success',
                onContinue: undefined,
                autoCloseMs: 3000,
            });
        } catch (error) {
            console.error('Failed to publish display configuration:', error);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.PublishFailed');
            showFeedback({
                title: 'Publish failed',
                message: 'Unable to publish the display configuration. Please try again.',
                status: 'error',
                onContinue: undefined,
                autoCloseMs: 5000,
            });
        }
    };

    const handleDisplayDelete = async (config: DisplayConfigurationDto) => {
        const idNumber = config.id ? parseInt(config.id, 10) : NaN;
        if (Number.isNaN(idNumber)) {
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.DeleteFailed');
            return;
        }
        try {
            await displayConfigClient.delete(idNumber);
            setDisplayConfigs(prev => prev.filter(c => c.id !== config.id));
            showFeedback({
                title: 'Display configuration deleted',
                message: 'The display configuration has been removed.',
                status: 'success',
                onContinue: undefined,
                autoCloseMs: 3000,
            });
        } catch (error) {
            console.error('Failed to delete display configuration:', error);
            logging.errorHandler.next('ErrorMessage.DisplayConfiguration.DeleteFailed');
            showFeedback({
                title: 'Delete failed',
                message: 'Unable to delete the display configuration. Please try again.',
                status: 'error',
                onContinue: undefined,
            });
        }
    };

    const handleCreateFormConfiguration = () => {
        if (!selectedTypeName) {
            navigate('/admin/form-configurations/new');
            return;
        }
        navigate(`/admin/form-configurations/new?entity=${encodeURIComponent(selectedTypeName)}`);
    };

    const handleCreateFormConfigurationAsDefault = () => {
        if (!selectedTypeName) {
            navigate('/admin/form-configurations/new');
            return;
        }
        navigate(`/admin/form-configurations/new?entity=${encodeURIComponent(selectedTypeName)}&default=true`);
    };

    const handleCreateDisplayConfiguration = () => {
        if (!selectedTypeName) {
            navigate('/admin/display-configurations/new');
            return;
        }
        navigate(`/admin/display-configurations/new?entity=${encodeURIComponent(selectedTypeName)}`);
    };

    const handleCreateDisplayConfigurationAsDefault = () => {
        if (!selectedTypeName) {
            navigate('/admin/display-configurations/new');
            return;
        }
        navigate(`/admin/display-configurations/new?entity=${encodeURIComponent(selectedTypeName)}&default=true`);
    };

    const handleToggleColumn = (columnKey: string) => {
        setColumnDraft(prev => {
            const exists = prev.some(key => key.toLowerCase() === columnKey.toLowerCase());
            if (exists) {
                return prev.filter(key => key.toLowerCase() !== columnKey.toLowerCase());
            }

            return canonicalizeColumnKeys([...prev, columnKey]);
        });
    };

    const handleColumnDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        setColumnDraft(prev => {
            const oldIndex = prev.findIndex(key => key === active.id);
            const newIndex = prev.findIndex(key => key === over.id);

            if (oldIndex === -1 || newIndex === -1) {
                return prev;
            }

            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    const handleSaveDefaultColumns = async () => {
        if (!selectedTypeName) {
            return;
        }

        const cleanedColumns = columnDraft
            .map(key => key.trim())
            .filter(Boolean)
            .filter((key, index, array) => array.findIndex(entry => entry.toLowerCase() === key.toLowerCase()) === index);

        const guardedColumns = applyNameDisplayNameGuard(cleanedColumns, selectedEntityMetadata);
        const normalizedColumns = canonicalizeColumnKeys(guardedColumns);

        if (normalizedColumns.length === 0) {
            showFeedback({
                title: 'No columns selected',
                message: 'Select at least one column before saving.',
                status: 'info',
                onContinue: undefined,
                autoCloseMs: 2500,
            });
            return;
        }

        try {
            setSavingColumns(true);

            const existingConfiguration = configurations.find(
                cfg => cfg.entityTypeName.toLowerCase() === selectedTypeName.toLowerCase()
            );

            if (existingConfiguration) {
                await updateConfiguration({
                    ...existingConfiguration,
                    defaultTableColumns: normalizedColumns,
                });
            } else {
                await createConfiguration({
                    entityTypeName: selectedTypeName,
                    iconKey: null,
                    customIconUrl: null,
                    displayColor: null,
                    sortOrder: 0,
                    isVisible: true,
                    defaultTableColumns: normalizedColumns,
                });
            }

            await refresh();
            showFeedback({
                title: 'Columns saved',
                message: 'Default table columns have been updated for this entity.',
                status: 'success',
                onContinue: undefined,
                autoCloseMs: 3000,
            });
        } catch (error) {
            console.error('Failed to save default table columns:', error);
            logging.errorHandler.next('ErrorMessage.EntityTypeConfiguration.SaveFailed');
            showFeedback({
                title: 'Save failed',
                message: 'Unable to save default table columns. Please try again.',
                status: 'error',
                onContinue: undefined,
            });
        } finally {
            setSavingColumns(false);
        }
    };

    // Handler: Complete wizard
    const handleComplete = async (data: any, progress?: FormSubmissionProgressDto) => {
        try {
            if (progress && progress.entityTypeName) {
                let createFn: (entity: any) => Promise<any>;
                let updateFn: (entity: any) => Promise<any>;

                try {
                    createFn = getCreateFunctionForEntity(progress.entityTypeName);
                    updateFn = getUpdateFunctionForEntity(progress.entityTypeName);
                } catch (mappingErr) {
                    console.error('No API client registered for entity type:', progress.entityTypeName, mappingErr);
                    logging.errorHandler.next(`ErrorMessage.${progress.entityTypeName}.ClientNotFound`);
                    showFeedback({
                        title: 'Submit failed',
                        message: `No API client configured for ${progress.entityTypeName}. Please contact an administrator.`,
                        status: 'error',
                        onContinue: undefined
                    });
                    return;
                }

                const entityIdToUse = entityId || progress.entityId;
                const entityData = { ...data, id: entityIdToUse ?? undefined };

                let createdEntityId: any;
                if (entityIdToUse) {
                    await updateFn(entityData);
                    createdEntityId = entityIdToUse;
                } else {
                    const createdEntity = await createFn(entityData);
                    createdEntityId = createdEntity?.id;
                }

                // added: if this was a child entity creation for a parent relationship, update parent
                if (parentEntityTypeName && parentEntityId && relationshipFieldName && !entityIdToUse) {
                    try {
                        const fetchParent = getFetchByIdFunctionForEntity(parentEntityTypeName);
                        const updateParent = getUpdateFunctionForEntity(parentEntityTypeName);

                        const parent = await fetchParent(parentEntityId);
                        parent[relationshipFieldName] = createdEntityId;
                        await updateParent(parent);
                        console.log(`Updated parent ${parentEntityTypeName}(${parentEntityId}).${relationshipFieldName} = ${createdEntityId}`);
                    } catch (parentErr) {
                        console.error('Failed to update parent entity relationship:', parentErr);
                        logging.errorHandler.next('ErrorMessage.Entity.ParentUpdateFailed');
                        showFeedback({
                            title: 'Parent update failed',
                            message: 'The entity was created, but the parent relationship could not be updated.',
                            status: 'error',
                            onContinue: undefined
                        });
                    }
                }

                setShowWizard(false);
                setWizardConfig(null);
                setWizardProgressId(undefined);

                // added: if parent context exists, redirect back to parent display page
                if (parentEntityTypeName && parentEntityId) {
                    showFeedback({
                        title: 'Form completed',
                        message: 'Your form has been submitted successfully.',
                        status: 'success',
                        onContinue: () => navigate(`/display/${parentEntityTypeName}/${parentEntityId}`),
                        autoCloseMs: 3000,
                    });
                } else {
                    showFeedback({
                        title: 'Form completed',
                        message: 'Your form has been submitted successfully.',
                        status: 'success',
                        onContinue: () => navigate('/dashboard', { state: { entityTypeName: progress.entityTypeName } }),
                        autoCloseMs: 3000,
                    });
                }
            }
        } catch (err) {
            logging.errorHandler.next('ErrorMessage.Entity.SaveFailed');
            console.error('Failed to create/update entity:', err);
            showFeedback({
                title: 'Submit failed',
                message: 'The form could not be submitted. Please review and try again.',
                status: 'error',
                onContinue: undefined,
            });
        }
    };

    // changed: simplified handleSelectEntity since selectedObjectType is now synced automatically
    const handleSelectEntity = (type: string) => {
        navigate(`/forms/${type}`);
    };

    // Loading state
    if (metadataLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading available forms...</p>
                </div>
            </div>
        );
    }

    // Notification logic
    const showNoConfigs = selectedTypeName && formConfigs.length === 0 && !showWizard;
    const showNoDefault = selectedTypeName && formConfigs.length > 0 && !defaultConfig && !showWizard && !shouldAutoOpen;
    const showTooManyDefaults = selectedTypeName && formConfigs.filter(cfg => cfg.isDefault).length > 1 && !showWizard;

    return (
        <>
            <div className="dashboard-parent">
                <div className='dashboard-sidebar'>
                    <ObjectTypeExplorer
                        entityMetadata={resolvedBaseMetadata}
                        onSelect={handleSelectEntity}
                        selectedId={selectedTypeName}
                    />
                </div>
                <div className='dashboard-content'>
                    {/* Quick access to builders */}
                    <div className="flex justify-end mb-4 gap-2">
                        <button
                            onClick={() => navigate('/admin/display-configurations')}
                            className="btn-secondary text-sm"
                        >
                            Open Display Builder
                        </button>
                        <button
                            onClick={() => navigate('/admin/form-configurations')}
                            className="btn-secondary text-sm"
                        >
                            Open Form Builder
                        </button>
                    </div>

                    <div className="mb-4">
                        <EntityMetadataNavigator metadata={selectedEntityMetadata} />
                    </div>

                    {selectedTypeName && !showWizard && (
                        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900">Default Table Columns</h3>
                                    <p className="text-sm text-gray-600">Configure which columns are shown first in entity tables and related pickers.</p>
                                </div>
                                <button
                                    onClick={handleSaveDefaultColumns}
                                    disabled={savingColumns || columnDraft.length === 0}
                                    className="btn-primary text-sm disabled:opacity-60"
                                >
                                    {savingColumns ? 'Saving...' : 'Save Columns'}
                                </button>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Selected order</p>
                                {columnDraft.length === 0 ? (
                                    <p className="text-sm text-gray-500">No columns selected.</p>
                                ) : (
                                    <DndContext
                                        sensors={columnSensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleColumnDragEnd}
                                    >
                                        <SortableContext
                                            items={columnDraft}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2">
                                                {columnDraft.map(key => (
                                                    <SortableColumnItem
                                                        key={key}
                                                        columnKey={key}
                                                        label={toLabel(key)}
                                                        onRemove={() => handleToggleColumn(key)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Available columns</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {availableColumns.map(option => {
                                        const checked = columnDraft.some(key => key.toLowerCase() === option.key.toLowerCase());
                                        return (
                                            <label key={option.key} className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => handleToggleColumn(option.key)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span>{option.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notification bar */}
                    {(showNoConfigs || showNoDefault || showTooManyDefaults) && (
                        <div className="mb-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-center">
                                <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-yellow-800">
                                    {showNoConfigs
                                        ? `No form configurations found for "${selectedEntityMetadata?.displayName || selectedObjectType?.label || selectedTypeName}". Please create a configuration first.`
                                        : showNoDefault
                                        ? `No default configuration set for "${selectedEntityMetadata?.displayName || selectedObjectType?.label || selectedTypeName}". Please set one as default to enable form wizard.`
                                        : `Too many default configurations found for "${selectedEntityMetadata?.displayName || selectedObjectType?.label || selectedTypeName}". Please ensure only one default is set.`}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Use Case 1 or 4: Show FormWizard */}
                    {showWizard && wizardConfig ? (
                        <FormWizard
                            entityName={selectedTypeName}
                            entityId={entityId}
                            formConfigurationId={wizardConfig.id}
                            userId={userId}
                            onComplete={(data, progress) => handleComplete(data, progress)}
                            existingProgressId={wizardProgressId}
                            workflowSessionId={workflowSessionId}
                            onStepAdvanced={({ from, stepKey }) => {
                                if (workflowSessionId != null) {
                                    workflowClient.completeStep(workflowSessionId, stepKey, from).catch(() => {});
                                }
                            }}
                            worldTaskHint={"Missing in-game confirmation. You can continue later."}
                            // entityMetadata={entityMetadata} // optional: can be added to FormWizard props
                        />
                    ) : (
                        /* Use Case 2 or 3: Show configurations and progress */
                        <div className="space-y-6">
                            {loadingConfigs ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {selectedTypeName ? (
                                        /* Use Case 2: Entity selected, show configs and progress */
                                        <>
                                            <FormConfigurationTable
                                                configurations={formConfigs}
                                                onOpen={(config) => handleOpenConfiguration(config)}
                                                onSetDefault={handleSetDefault}
                                                onRemoveDefault={handleRemoveDefault}
                                                onEdit={handleEditConfiguration}
                                                onDelete={handleFormConfigDelete}
                                                onCreate={handleCreateFormConfiguration}
                                                onCreateDefault={handleCreateFormConfigurationAsDefault}
                                            />

                                            {loadingDisplayConfigs ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                                </div>
                                            ) : (
                                                <DisplayConfigurationTable
                                                    configurations={displayConfigs}
                                                    onEdit={handleDisplayEdit}
                                                    onSetDefault={handleDisplaySetDefault}
                                                    onRemoveDefault={handleDisplayRemoveDefault}
                                                    onPublish={handleDisplayPublish}
                                                    onDelete={handleDisplayDelete}
                                                    onCreate={handleCreateDisplayConfiguration}
                                                    onCreateDefault={handleCreateDisplayConfigurationAsDefault}
                                                />
                                            )}
                                            
                                            <SavedProgressList
                                                progressList={savedProgress}
                                                onResume={(progress) => handleResumeProgress(progress as FormSubmissionProgressSummaryDto)}
                                                onDelete={(progress) => handleDeleteProgress(progress as FormSubmissionProgressSummaryDto)}
                                            />
                                        </>
                                    ) : (
                                        /* Use Case 3: No entity selected */
                                        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                                            <p className="text-gray-500">
                                                Select an entity from the sidebar to view available forms
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <FeedbackModal
                open={feedbackModal.open}
                title={feedbackModal.title}
                message={feedbackModal.message}
                status={feedbackModal.status}
                onClose={closeFeedbackModal}
                onContinue={handleFeedbackContinue}
                autoCloseMs={feedbackModal.autoCloseMs}
            />
        </>
    );
};

function toLabel(value: string): string {
    if (!value) {
        return '';
    }

    return value
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .replace(/^./, char => char.toUpperCase())
        .trim();
}

function applyNameDisplayNameGuard(columns: string[], metadata: any): string[] {
    const fieldNames = new Set(
        [
            ...((metadata?.fields || []).map((field: any) => String(field.fieldName || '').toLowerCase())),
            ...((metadata?.properties || []).map((property: any) => String(property.name || '').toLowerCase())),
        ].filter(Boolean)
    );

    const hasNameField = fieldNames.has('name');
    const hasDisplayNameField = fieldNames.has('displayname');

    if (!hasNameField && hasDisplayNameField) {
        return columns.map(key => key.toLowerCase() === 'name' ? 'displayName' : key);
    }

    return columns;
}

interface SortableColumnItemProps {
    columnKey: string;
    label: string;
    onRemove: () => void;
}

function SortableColumnItem({ columnKey, label, onRemove }: SortableColumnItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: columnKey });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 bg-gray-50"
        >
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                    aria-label={`Reorder ${label}`}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-800">{label}</span>
            </div>

            <button
                type="button"
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-600"
                aria-label={`Remove ${label}`}
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}

