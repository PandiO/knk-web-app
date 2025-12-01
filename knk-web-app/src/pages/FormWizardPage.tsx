import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormWizard } from '../components/FormWizard/FormWizard';
import ObjectTypeExplorer from '../components/ObjectTypeExplorer';
import { objectConfigs } from '../config/objectConfigs';
import { formConfigClient } from '../apiClients/formConfigClient';
import { formSubmissionClient } from '../apiClients/formSubmissionClient';
import { FormConfigurationDto, FormSubmissionProgressDto, FormSubmissionProgressSummaryDto } from '../utils/domain/dto/forms/FormModels';
import { FormConfigurationTable } from '../components/FormWizard/FormConfigurationTable';
import { SavedProgressList } from '../components/FormWizard/SavedProgressList';
import { Loader2 } from 'lucide-react';
import { logging } from '../utils';
import { CategoryClient } from '../apiClients/categoryClient';

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { entityTypeName: string; objectTypes: ObjectType[]; entityId?: string };
type ApiClient = {
    getInstance: () => ApiClient;
    create: (data: any) => Promise<any>;
    update: (data: any) => Promise<any>;
    getById: (id: string) => Promise<any>;
};

export const FormWizardPage: React.FC<Props> = ({ entityTypeName: typeName, objectTypes, entityId: propsEntityId }: Props) => {
    const navigate = useNavigate();
    const { entityName, entityId: urlEntityId } = useParams<{ entityName: string; entityId?: string }>();
    
    // Prioritize URL params over props
    const entityId = urlEntityId || propsEntityId;
    const selectedTypeName = entityName || typeName || '';
    
    const [selectedObjectType, setSelectedObjectType] = useState<ObjectType | null>(
        objectTypes.find(ot => ot.id === selectedTypeName) || null
    );
    const [initialLoading, setInitialLoading] = useState(true);
    const [entityNamesLower, setEntityNamesLower] = useState<string[]>([]);
    
    const [formConfigs, setFormConfigs] = useState<FormConfigurationDto[]>([]);
    const [defaultConfig, setDefaultConfig] = useState<FormConfigurationDto | null>(null);
    const [savedProgress, setSavedProgress] = useState<FormSubmissionProgressSummaryDto[]>([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);
    
    // State to track if FormWizard should be shown
    const [showWizard, setShowWizard] = useState(false);
    const [wizardConfig, setWizardConfig] = useState<FormConfigurationDto | null>(null);
    const [wizardProgressId, setWizardProgressId] = useState<string | undefined>(undefined);

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

    // Main effect: Handle the three use cases
    useEffect(() => {
        // Use Case 3: No entity selected
        if (!selectedTypeName) {
            setShowWizard(false);
            setFormConfigs([]);
            setSavedProgress([]);
            setDefaultConfig(null);
            return;
        }

        // Use Case 1: Entity ID provided (edit mode)
        if (entityId) {
            loadDefaultConfigForEdit(selectedTypeName);
            return;
        }

        // Use Case 2: Only entity name provided (show configs and progress)
        loadConfigurationsAndProgress(selectedTypeName);
    }, [selectedTypeName, entityId]);

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
        } catch (error) {
            console.error('Failed to delete progress:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.DeleteFailed');
        }
    };

    // Handler: Delete configuration
    const handleFormConfigDelete = async (config: FormConfigurationDto) => {
        if (!confirm('Are you sure you want to delete this form configuration?')) return;

        try {
            await formConfigClient.delete(config.id!);
            setFormConfigs(prev => prev.filter(c => c.id !== config.id));
        } catch (error) {
            console.error('Failed to delete configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.DeleteFailed');
        }
    };

    // Utility: Get API client for entity type
    const getApiClient = (entityTypeName: string): ApiClient | null => {
        const normalizedTypeName = entityTypeName.toLowerCase();
        
        const clientMap: Record<string, ApiClient> = {
            category: CategoryClient.getInstance() as unknown as ApiClient,
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
            }
        } catch (err) {
            logging.errorHandler.next('ErrorMessage.Entity.SaveFailed');
            console.error('Failed to create/update entity:', err);
        }

        setShowWizard(false);
        setWizardConfig(null);
        setWizardProgressId(undefined);
        navigate(`/dashboard`);
    };

    // Handler: Select entity from sidebar
    const handleSelectEntity = (type: string) => {
        navigate(`/forms/${type}`);
        setSelectedObjectType(objectTypes.find(ot => ot.id === type) || null);
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
    const showNoDefault = selectedTypeName && formConfigs.length > 0 && !defaultConfig && !showWizard;
    const showTooManyDefaults = selectedTypeName && formConfigs.filter(cfg => cfg.isDefault).length > 1 && !showWizard;

    return (
        <div className="dashboard-parent">
            <div className='dashboard-sidebar'>
                <ObjectTypeExplorer
                    items={sidebarItems}
                    onSelect={handleSelectEntity}
                />
            </div>
            <div className='dashboard-content'>
                {/* Notification bar */}
                {(showNoConfigs || showNoDefault || showTooManyDefaults) && (
                    <div className="mb-4">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-center">
                            <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-yellow-800">
                                {showNoConfigs
                                    ? `No form configurations found for "${selectedObjectType?.label}". Please create a configuration first.`
                                    : showNoDefault
                                    ? `No default configuration set for "${selectedObjectType?.label}". Please set one as default to enable form wizard.`
                                    : `Too many default configurations found for "${selectedObjectType?.label}". Please ensure only one default is set.`}
                            </span>
                        </div>
                    </div>
                )}

                {/* Use Case 1 or when user opens a config: Show FormWizard */}
                {showWizard && wizardConfig ? (
                    <FormWizard
                        entityName={selectedTypeName}
                        entityId={entityId}
                        userId={userId}
                        onComplete={(data, progress) => handleComplete(data, progress)}
                        existingProgressId={wizardProgressId}
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
    );
};
