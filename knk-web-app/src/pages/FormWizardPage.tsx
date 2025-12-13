import { Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CategoryClient } from '../apiClients/categoryClient';
import { displayConfigClient } from '../apiClients/displayConfigClient';
import { formConfigClient } from '../apiClients/formConfigClient';
import { formSubmissionClient } from '../apiClients/formSubmissionClient';
import { FeedbackModal } from '../components/FeedbackModal';
import { DisplayConfigurationTable } from '../components/FormWizard/DisplayConfigurationTable';
import { FormConfigurationTable } from '../components/FormWizard/FormConfigurationTable';
import { FormWizard } from '../components/FormWizard/FormWizard';
import { SavedProgressList } from '../components/FormWizard/SavedProgressList';
import ObjectTypeExplorer from '../components/ObjectTypeExplorer';
import { objectConfigs } from '../config/objectConfigs';
import { logging } from '../utils';
import { FormConfigurationDto, FormSubmissionProgressDto, FormSubmissionProgressSummaryDto } from '../utils/domain/dto/forms/FormModels';
import { FieldMetadataDto } from '../utils/domain/dto/metadata/MetadataModels';
import { DisplayConfigurationDto } from '../utils/domain/dto/displayConfig/DisplayModels';
import { DistrictClient } from '../apiClients/districtClient';
import { LocationClient } from '../apiClients/locationClient';
import { StreetClient } from '../apiClients/streetClient';
import { StructureClient } from '../apiClients/structureClient';
import { TownClient } from '../apiClients/townClient';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { 
    entityTypeName: string; 
    objectTypes: ObjectType[]; 
    entityId?: string;
    // added: explicit prop to control auto-opening of default form
    autoOpenDefaultForm?: boolean;
};
type ApiClient = {
    getInstance: () => ApiClient;
    create: (data: any) => Promise<any>;
    update: (data: any) => Promise<any>;
    getById: (id: string) => Promise<any>;
};

// changed: destructure new prop with default value
export const FormWizardPage: React.FC<Props> = ({ 
    entityTypeName: typeName, 
    objectTypes, 
    entityId: propsEntityId,
    autoOpenDefaultForm = false 
}: Props) => {
    const navigate = useNavigate();
    const { entityName, entityId: urlEntityId } = useParams<{ entityName: string; entityId?: string }>();
    // added: read query parameter for auto-open
    const [searchParams] = useSearchParams();
    
    // Prioritize URL params over props
    const entityId = urlEntityId || propsEntityId;
    const selectedTypeName = entityName || typeName || '';
    
    // changed: check both prop and query parameter for auto-open
    const shouldAutoOpen = autoOpenDefaultForm || searchParams.get('autoOpen') === 'true';

    const [selectedObjectType, setSelectedObjectType] = useState<ObjectType | null>(
        objectTypes.find(ot => ot.id === selectedTypeName) || null
    );
    const [initialLoading, setInitialLoading] = useState(true);
    const [entityNamesLower, setEntityNamesLower] = useState<string[]>([]);
    
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
    const [entityMetadata, setEntityMetadata] = useState<FieldMetadataDto[]>([]);
    const [autoOpenForm, setAutoOpenForm] = useState(false); // removed: old auto-open flag logic

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

    // Load available entity names on mount
    useEffect(() => {
        const fetchAvailableEntityNames = async () => {
            try {
                setInitialLoading(true);
                const entityNames = await formConfigClient.getEntityNames();
                const normalized = (entityNames || [])
                    .map((n: string) => n?.trim().toLowerCase())
                    .filter(Boolean);
                setEntityNamesLower(normalized);
            } catch (error) {
                console.error('Failed to fetch entity names:', error);
                setEntityNamesLower(Object.keys(objectConfigs).map(k => k.toLowerCase()));
            } finally {
                setInitialLoading(false);
            }
        };
        fetchAvailableEntityNames();
    }, []);

    // Sidebar items filtered by available entity names
    const sidebarItems = useMemo(() => {
        return Object.entries(objectConfigs)
            .filter(([key, config]) => {
                const keyLower = key.toLowerCase();
                const typeLower = (config.type || '').toLowerCase();
                const labelLower = (config.label || '').toLowerCase();
                return (
                    entityNamesLower.includes(keyLower) ||
                    entityNamesLower.includes(typeLower) ||
                    entityNamesLower.includes(labelLower)
                );
            })
            .map(([type, config]) => ({
                id: type,
                label: config.label,
                icon: config.icon,
                createRoute: `/forms/${type}`,
            }));
    }, [entityNamesLower]);

    // added: Update selectedObjectType whenever selectedTypeName changes
    useEffect(() => {
        if (selectedTypeName) {
            const matchingType = objectTypes.find(ot => ot.id === selectedTypeName);
            setSelectedObjectType(matchingType || null);
        } else {
            setSelectedObjectType(null);
        }
    }, [selectedTypeName, objectTypes]);

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
        if (autoOpenForm && defaultConfig && !showWizard && !loadingConfigs) {
            // Automatically open the default form configuration
            setWizardConfig(defaultConfig);
            setWizardProgressId(undefined);
            setShowWizard(true);
        }
    }, [autoOpenForm, defaultConfig, showWizard, loadingConfigs]);

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
    const handleOpenConfiguration = (config: FormConfigurationDto, progressId?: string) => {
        setWizardConfig(config);
        setWizardProgressId(progressId);
        setShowWizard(true);
    };

    // Handler: Set default configuration
    const handleSetDefault = async (config: FormConfigurationDto) => {
        const existingDefault = formConfigs.find(c => c.id !== config.id && c.isDefault);
        
        if (existingDefault) {
            if (!confirm(`There is already a default configuration for "${selectedTypeName}". Do you want to change the default to "${config.configurationName}"?`)) {
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
        if (!confirm('Are you sure you want to delete this saved progress?')) return;

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
        if (!confirm('Are you sure you want to delete this form configuration?')) return;

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
            if (!confirm(`There is already a default display configuration for "${selectedTypeName}". Change default to "${config.name}"?`)) {
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

    // Utility: Get API client for entity type
    const getApiClient = (entityTypeName: string): ApiClient | null => {
        const normalizedTypeName = entityTypeName.toLowerCase();
        
        const clientMap: Record<string, ApiClient> = {
            category: CategoryClient.getInstance() as unknown as ApiClient,
            location: LocationClient.getInstance() as unknown as ApiClient,
            street: StreetClient.getInstance() as unknown as ApiClient,
            town: TownClient.getInstance() as unknown as ApiClient,
            district: DistrictClient.getInstance() as unknown as ApiClient,
            structure: StructureClient.getInstance() as unknown as ApiClient,
            // user: UserClient.getInstance() as unknown as ApiClient, // User client not implemented
            // Add other clients here as needed
        };
        
        const client = clientMap[normalizedTypeName];
        if (!client) {
            console.error(`No API client found for entity type: ${entityTypeName}`);
            logging.errorHandler.next(`ErrorMessage.${entityTypeName}.ClientNotFound`);
            return null;
        }
        return client;
    };

    // Handler: Complete wizard
    const handleComplete = async (data: any, progress?: FormSubmissionProgressDto) => {
        try {
            if (progress && progress.entityTypeName) {
                const client = getApiClient(progress.entityTypeName);
                if (!client) {
                    logging.errorHandler.next(`ErrorMessage.${progress.entityTypeName}.ClientNotFound`);
                    return;
                }

                const entityIdToUse = entityId || progress.entityId;
                const entityData = { ...data, id: entityIdToUse ?? undefined };

                if (entityIdToUse) {
                    await client.update(entityData);
                } else {
                    await client.create(entityData);
                }

                setShowWizard(false);
                setWizardConfig(null);
                setWizardProgressId(undefined);
                showFeedback({
                    title: 'Form completed',
                    message: 'Your form has been submitted successfully.',
                    status: 'success',
                    onContinue: () => navigate('/dashboard', { state: { entityTypeName: progress.entityTypeName } }),
                    autoCloseMs: 3000,
                });
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
    if (initialLoading) {
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
                        items={sidebarItems}
                        onSelect={handleSelectEntity}
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
                    {/* Notification bar */}
                    {(showNoConfigs || showNoDefault || showTooManyDefaults) && (
                        <div className="mb-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-center">
                                <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-yellow-800">
                                    {showNoConfigs
                                        ? `No form configurations found for "${selectedObjectType?.label || selectedTypeName}". Please create a configuration first.`
                                        : showNoDefault
                                        ? `No default configuration set for "${selectedObjectType?.label || selectedTypeName}". Please set one as default to enable form wizard.`
                                        : `Too many default configurations found for "${selectedObjectType?.label || selectedTypeName}". Please ensure only one default is set.`}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Use Case 1 or 4: Show FormWizard */}
                    {showWizard && wizardConfig ? (
                        <FormWizard
                            entityName={selectedTypeName}
                            entityId={entityId}
                            userId={userId}
                            onComplete={(data, progress) => handleComplete(data, progress)}
                            existingProgressId={wizardProgressId}
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
                                                    onDelete={handleDisplayDelete}
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
