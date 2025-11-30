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

type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { typeName: string; objectTypes: ObjectType[] };

export const FormWizardPage: React.FC<Props> = ({ typeName, objectTypes }: Props) => {
    const navigate = useNavigate();
    // This const extracts the entityName from the URL if typeName prop is not provided
    const { entityName } = useParams<{ entityName: string }>();
    // This state holds the currently selected type name
    const [selectedTypeName, setSelectedTypeName] = useState(typeName || entityName || '');
    const [selectedObjectType, setSelectedObjectType] = useState<ObjectType | null>(objectTypes.find(ot => ot.id === (typeName || entityName)) || null);
    const [loading, setLoading] = useState(true);
    const [entityNamesLower, setEntityNamesLower] = useState<string[]>([]);
    
    const [formConfigs, setFormConfigs] = useState<FormConfigurationDto[]>([]);
    const [savedProgress, setSavedProgress] = useState<FormSubmissionProgressSummaryDto[]>([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);
    const [activeWizard, setActiveWizard] = useState<{
        configId?: string;
        config?: FormConfigurationDto;
        progressId?: string;
    } | null>(null);

    // changed: if prop is empty, use the URL param
    useEffect(() => {
        if (!typeName || typeName.trim() === '') {
            setSelectedTypeName(entityName || '');
            setSelectedObjectType(objectTypes.find(ot => ot.id === (entityName || '')) || null);
        } else {
            setSelectedTypeName(typeName);
            setSelectedObjectType(objectTypes.find(ot => ot.id === typeName) || null);
        }
    }, [typeName, entityName]);

    // changed: fetch entity names and store normalized list
    useEffect(() => {
        const fetchAvailableEntityNames = async () => {
            try {
                setLoading(true);
                const entityNames = await formConfigClient.getEntityNames();
                const normalized = (entityNames || [])
                    .map((n: string) => n?.trim().toLowerCase())
                    .filter(Boolean);
                setEntityNamesLower(normalized);
            } catch (error) {
                console.error('Failed to fetch entity names:', error);
                // fallback: show all provided objectTypes if API fails
                setEntityNamesLower(
                    Object.keys(objectConfigs).map(k => k.toLowerCase())
                );
            } finally {
                setLoading(false);
            }
        };
        fetchAvailableEntityNames();
    }, [objectTypes]);

    // added: fetch configurations and progress when selectedTypeName changes
    useEffect(() => {
        if (!selectedTypeName) return;

        const fetchConfigurationsAndProgress = async () => {
            try {
                setLoadingConfigs(true);
                
                // Fetch all configurations for the selected entity
                const configs = await formConfigClient.getByEntityTypeName(selectedTypeName, false) as FormConfigurationDto[];
                
                // Sort configurations: default first
                const sortedConfigs = [...configs].sort((a, b) => {
                    if (a.isDefault && !b.isDefault) return -1;
                    if (!a.isDefault && b.isDefault) return 1;
                    return 0;
                });
                
                setFormConfigs(sortedConfigs);

                // Fetch saved progress for current user
                const userId = '1'; // TODO: Get from auth context
                const progress: FormSubmissionProgressSummaryDto[] | [] = await formSubmissionClient.getByEntityTypeName(selectedTypeName, userId, true) as FormSubmissionProgressSummaryDto[];
                
                // Filter progress for current entity
                const entityProgress = progress.filter(p => 
                    p.entityTypeName?.toLowerCase() === selectedTypeName.toLowerCase()
                );
                
                setSavedProgress(entityProgress);
            } catch (error) {
                console.error('Failed to fetch configurations or progress:', error);
                logging.errorHandler.next('ErrorMessage.FormConfiguration.LoadFailed');
            } finally {
                setLoadingConfigs(false);
            }
        };

        fetchConfigurationsAndProgress();
    }, [selectedTypeName]);

    // added: derive filtered sidebar items from objectConfigs + normalized names
    const sidebarItems = useMemo(() => {
        let items = Object.entries(objectConfigs)
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
        return items;
    }, [entityNamesLower]);

    const userId = '1';

    // added: handler for opening a configuration
    const handleOpenConfiguration = (configId?: string, config?: FormConfigurationDto, progressId?: string) => {
        setActiveWizard({ configId, config, progressId });
    };

    // added: handler for setting default configuration
    const handleSetDefault = async (config: FormConfigurationDto) => {
        if (formConfigs.some(c => c.id !== config.id && c.isDefault)) {
            //Write code to display confirmation prompt to user asking if they want to change default, with display of current default config name and id
            if (confirm(`There is already a default configuration for "${selectedTypeName}". Do you want to change the default to "${config.configurationName}"?`)) {
                //Remove default from other configs
                const otherDefaults = formConfigs.filter(c => c.id !== config.id && c.isDefault);
                for (const otherDefault of otherDefaults) {
                    await handleRemoveDefault(otherDefault);
                }
            } else {
                return;
            }
        }
        try {
            // Update the configuration to be default
            const updatedConfig = { ...config, isDefault: true };
            await formConfigClient.update(updatedConfig);
            
            // Refresh configurations
            const configs = await formConfigClient.getByEntityTypeName(selectedTypeName, false) as FormConfigurationDto[];
            const sortedConfigs = [...configs].sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                return 0;
            });
            setFormConfigs(sortedConfigs);
        } catch (error) {
            console.error('Failed to set default configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
        }
    };

        // added: handler for setting default configuration
    const handleRemoveDefault = async (config: FormConfigurationDto) => {
        try {
            // Update the configuration to be default
            const updatedConfig = { ...config, isDefault: false };
            await formConfigClient.update(updatedConfig);
            
            // Refresh configurations
            const configs = await formConfigClient.getByEntityTypeName(selectedTypeName, false) as FormConfigurationDto[];
            const sortedConfigs = [...configs].sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                return 0;
            });
            setFormConfigs(sortedConfigs);
        } catch (error) {
            console.error('Failed to set default configuration:', error);
            logging.errorHandler.next('ErrorMessage.FormConfiguration.SaveFailed');
        }
    };

    // added: handler for editing configuration
    const handleEditConfiguration = (config: FormConfigurationDto) => {
        navigate(`/admin/form-configurations/edit/${config.id}`);
    };

    const handleResumeProgress = async (progress: FormSubmissionProgressSummaryDto) => {
        try {
            const fullProgress = await formSubmissionClient.getById(progress.id!);
            if (fullProgress.formConfigurationId) {
                handleOpenConfiguration(fullProgress.formConfigurationId, undefined, fullProgress.id);
            }
        } catch (error) {
            console.error('Failed to resume progress:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.LoadFailed');
        }
    };

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

    // Utility: get correct client singleton from io folder
    const getApiClient = (entityTypeName: string) => {
        // Map entityTypeName to client variable name
        // Example: "formStepClient" => formStepClient
        try {
            // All clients should be imported at the top of this file
            // Add more mappings as needed
            const clientMap: Record<string, any> = {
                formStepClient: require('../io/formStepClient').formStepClient,
                formConfigClient: require('../io/formConfigClient').formConfigClient,
                formFieldClient: require('../io/formFieldClient').formFieldClient,
                formSubmissionClient: require('../io/formSubmissionClient').formSubmissionClient,
                // Add other clients here as needed
                // Example: structuresManager: require('../io/structures').structuresManager,
            };
            return clientMap[entityTypeName];
        } catch (err) {
            logging.errorHandler.next(`ErrorMessage.${entityTypeName}.ClientNotFound`);
            return null;
        }
    };

    // added: handler for completing wizard
    const handleComplete = async (data: any, progress?: FormSubmissionProgressDto) => {
        console.log('Form completed with data:', data);

        // --- DYNAMIC ENTITY CREATION/UPDATE ---
        try {
            // Use progress from FormWizard if available, else skip
            if (progress && progress.entityTypeName) {
                const client = getApiClient(progress.entityTypeName);
                if (!client) {
                    logging.errorHandler.next(`ErrorMessage.${progress.entityTypeName}.ClientNotFound`);
                    return;
                }

                // Build entity object from allStepsData or progress
                // You may need to adapt this mapping for your domain
                const entityData = {
                    ...data,
                    id: progress.entityId ?? undefined,
                };

                // Call create or update based on entityId
                if (progress.entityId) {
                    // Update existing entity
                    await client.update(entityData);
                } else {
                    // Create new entity
                    await client.create(entityData);
                }
            }
        } catch (err) {
            logging.errorHandler.next('ErrorMessage.Entity.SaveFailed');
            console.error('Failed to create/update entity:', err);
        }

        setActiveWizard(null);
        // Refresh saved progress
        const fetchProgress = async () => {
            const progress = await formSubmissionClient.getByEntityTypeName(selectedTypeName, userId, true);
            const entityProgress = progress.filter(p => 
                p.entityTypeName?.toLowerCase() === selectedTypeName.toLowerCase()
            );
            setSavedProgress(entityProgress as FormSubmissionProgressSummaryDto[]);
        };
        fetchProgress();
    };

    const fetchDefaultFormConfig = ({ type }: { type: string }) => {
        setSelectedTypeName(type);
        setActiveWizard(null); // Close any active wizard
        setSelectedObjectType(objectTypes.find(ot => ot.id === type) || null);
    };

    if (loading) {
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
    const showNoConfigs = selectedTypeName && formConfigs.length === 0;
    const showNoDefault = selectedTypeName && formConfigs.length > 0 && !formConfigs.some(cfg => cfg.isDefault);
    const showTooManyDefaults = selectedTypeName && formConfigs.filter(cfg => cfg.isDefault).length > 1;

    return (
        <div className="dashboard-parent">
            <div className='dashboard-sidebar'>
                <ObjectTypeExplorer
                    items={sidebarItems}
                    onSelect={(type) => fetchDefaultFormConfig({ type })}
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
                                    : `Too many default configurations found for "${selectedObjectType?.label}". A default already exists: "${formConfigs.find(cfg => cfg.isDefault)?.configurationName}". Please ensure only one default is set.`}
                            </span>
                        </div>
                    </div>
                )}
                {activeWizard ? (
                    // Show FormWizard when a configuration is opened
                    <FormWizard
                        entityName={selectedTypeName}
                        userId={userId}
                        onComplete={(data, progress) => handleComplete(data, progress)}
                        existingProgressId={activeWizard.progressId}
                    />
                ) : (
                    // Show configurations and saved progress
                    <div className="space-y-6">
                        {loadingConfigs ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            </div>
                        ) : (
                            <>
                                {selectedTypeName ? (
                                    <>
                                        <FormConfigurationTable
                                            configurations={formConfigs}
                                            onOpen={(config) => handleOpenConfiguration(undefined, config)}
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
