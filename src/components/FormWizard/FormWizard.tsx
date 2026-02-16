import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Save, Check, AlertCircle } from 'lucide-react';
import { FormConfigurationDto, FormStepDto, FormFieldDto, StepData, AllStepsData, FormSubmissionProgressDto } from '../../types/dtos/forms/FormModels';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { ConditionEvaluator } from '../../utils/conditionEvaluator';
import { FormSubmissionStatus } from '../../utils/enums';
import { FieldRenderer } from './FieldRenderers';
import { logging } from '../../utils';
import { getFetchByIdFunctionForEntity } from '../../utils/entityApiMapping';
import { findValueByFieldName } from '../../utils/fieldNameMapper';
import { normalizeFormSubmission } from '../../utils/forms/normalizeFormSubmission';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { FeedbackModal } from '../FeedbackModal';
import { ChildFormModal } from './ChildFormModal';
import { ManyToManyRelationshipEditor } from './ManyToManyRelationshipEditor';
import { JoinEntityFormModal } from './JoinEntityFormModal';
import { workflowClient } from '../../apiClients/workflowClient';
import { StepProgressReadDto } from '../../types/dtos/workflow/WorkflowDtos';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';
import { FieldValidationRuleDto, ValidationResultDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { buildPlaceholderContext } from '../../utils/placeholderExtraction';

interface FormWizardProps {
    entityName: string;
    entityId?: string; // added: optional entity ID for edit mode
    formConfigurationId?: string; // added: optional specific form configuration to use
    userId: string;
    onComplete?: (data: Record<string, unknown>, progress?: FormSubmissionProgressDto) => void;
    existingProgressId?: string;
    parentProgressId?: string; // added: for nested child forms
    fieldName?: string; // added: field name this child form is for
    currentStepIndex?: number; // added: step index where child form is being created
    // workflow integration (optional)
    workflowSessionId?: number;
    onStepAdvanced?: (args: { from: number; to: number; stepKey: string }) => void;
    worldTaskHint?: string;
}

export const FormWizard: React.FC<FormWizardProps> = ({
    entityName,
    entityId: initialEntityId, // Rename to make clear this is the initial prop
    formConfigurationId, // added
    userId,
    onComplete,
    existingProgressId,
    parentProgressId, // added
    workflowSessionId,
    onStepAdvanced
    // Note: fieldName, currentStepIndex, and worldTaskHint props removed as unused
}) => {
    const [config, setConfig] = useState<FormConfigurationDto | null>(null);
    const [entityMetadata, setEntityMetadata] = useState<EntityMetadataDto | null>(null);
    const [joinEntityMetadataMap, setJoinEntityMetadataMap] = useState<Record<string, EntityMetadataDto>>({});
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [currentStepData, setCurrentStepData] = useState<StepData>({});
    const [allStepsData, setAllStepsData] = useState<AllStepsData>({});
    const [errors, setErrors] = useState<{ [fieldName: string]: string }>({});
    const [progressId, setProgressId] = useState<string | undefined>(existingProgressId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    // CRITICAL: Track entityId in state so it persists when loading from progress
    const [entityId, setEntityId] = useState<string | undefined>(initialEntityId);
    const [validationRules, setValidationRules] = useState<Record<number, FieldValidationRuleDto[]>>({});
    const [validationResults, setValidationResults] = useState<Record<number, ValidationResultDto>>({});
    const [validationLoading, setValidationLoading] = useState<Record<number, boolean>>({});
    const [preResolvedPlaceholders, setPreResolvedPlaceholders] = useState<Record<number, Record<string, string>>>({});
    const validationTimersRef = useRef<Record<number, number>>({});

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

    // added: state for child form modal
    type ChildFormState = {
        open: boolean;
        entityTypeName: string;
        fieldName: string;
    };
    const [childFormModal, setChildFormModal] = useState<ChildFormState>({
        open: false,
        entityTypeName: '',
        fieldName: ''
    });

    type JoinEntryModalState = {
        open: boolean;
        stepIndex: number | null;
        relationshipIndex: number | null;
        joinEntityType: string;
        joinConfigurationId: string;
        parentProgressId?: string;
        existingProgressId?: string;
    };

    const [joinEntryModal, setJoinEntryModal] = useState<JoinEntryModalState>({
        open: false,
        stepIndex: null,
        relationshipIndex: null,
        joinEntityType: '',
        joinConfigurationId: ''
    });

    const clearAutoClose = () => {
        if (autoCloseRef.current) {
            window.clearTimeout(autoCloseRef.current);
            autoCloseRef.current = undefined;
        }
    };

    const closeSaveModal = () => {
        clearAutoClose();
        setSaveFeedback(prev => ({ ...prev, open: false }));
    };

    useEffect(() => {
        return () => clearAutoClose();
    }, []);

    const getOrderedFields = (step?: FormStepDto): FormFieldDto[] => {
        if (!step) return [];
        if (!step.fieldOrderJson) {
            return [...step.fields].sort((a, b) => a.order - b.order);
        }

        try {
            const orderArray = JSON.parse(step.fieldOrderJson);
            if (!Array.isArray(orderArray) || orderArray.length === 0) {
                return [...step.fields].sort((a, b) => a.order - b.order);
            }

            const fieldMap = new Map<string, FormFieldDto>();
            step.fields.forEach(f => {
                if (f.fieldGuid) {
                    fieldMap.set(f.fieldGuid, f);
                }
            });

            const reordered: FormFieldDto[] = [];
            orderArray.forEach((guid: string) => {
                const field = fieldMap.get(guid);
                if (field) {
                    reordered.push(field);
                }
            });

            step.fields.forEach(f => {
                if (!reordered.includes(f)) {
                    reordered.push(f);
                }
            });

            return reordered;
        } catch {
            return [...step.fields].sort((a, b) => a.order - b.order);
        }
    };

    // Helpers to enforce full field shape per step and flatten for DTO
    const normalizeStepData = (step: FormStepDto, data: StepData | undefined): StepData => {
        const result: StepData = {};
        getOrderedFields(step)
            .forEach(field => {
                const hasValue = data && Object.prototype.hasOwnProperty.call(data, field.fieldName);
                const value = hasValue ? (data as StepData)[field.fieldName] : (field.defaultValue ?? null);
                result[field.fieldName] = value;
            });
        return result;
    };

    const normalizeAllStepsData = (cfg: FormConfigurationDto, stepsData: AllStepsData): AllStepsData => {
        const normalized: AllStepsData = {};
        cfg.steps.forEach((step, idx) => {
            normalized[idx] = normalizeStepData(step, stepsData?.[idx]);
        });
        return normalized;
    };

    const mergeChildProgressesIntoManyToManySteps = (
        cfg: FormConfigurationDto,
        stepsData: AllStepsData,
        childProgresses: FormSubmissionProgressDto[]
    ): AllStepsData => {
        if (!childProgresses || childProgresses.length === 0) return stepsData;

        const updated: AllStepsData = { ...stepsData };

        cfg.steps.forEach((step, idx) => {
            if (!step.isManyToManyRelationship || !step.joinEntityType) return;

            const fieldName = step.relatedEntityPropertyName || 'relationships';
            const existing = Array.isArray(updated[idx]?.[fieldName])
                ? (updated[idx]![fieldName] as Array<Record<string, unknown>>)
                : [];
            const mergedRelationships = [...existing];

            childProgresses
                .filter(child => child.entityTypeName === step.joinEntityType)
                .forEach(child => {
                    const parsedCurrent = JSON.parse(child.currentStepDataJson || '{}') as Record<string, unknown>;
                    const parsedAll = JSON.parse(child.allStepsDataJson || '{}') as Record<string, Record<string, unknown>>;
                    const mergedChildData = Object.values(parsedAll).reduce(
                        (acc, stepData) => ({ ...acc, ...stepData }),
                        { ...parsedCurrent }
                    );
                    const relatedEntityId = mergedChildData.relatedEntityId as string | number | undefined;

                    const existingIndex = mergedRelationships.findIndex(rel =>
                        rel.__childProgressId === child.id ||
                        (relatedEntityId !== undefined && rel.relatedEntityId === relatedEntityId)
                    );

                    const mergedRelationship: Record<string, unknown> = {
                        ...mergedChildData,
                        relatedEntityId,
                        __childProgressId: child.id
                    };

                    if (existingIndex >= 0) {
                        mergedRelationships[existingIndex] = {
                            ...mergedRelationships[existingIndex],
                            ...mergedRelationship
                        };
                    } else if (relatedEntityId !== undefined) {
                        mergedRelationships.push(mergedRelationship);
                    }
                });

            updated[idx] = {
                ...updated[idx],
                [fieldName]: mergedRelationships
            };
        });

        return updated;
    };

    const flattenAllStepsData = (cfg: FormConfigurationDto, stepsData: AllStepsData): Record<string, unknown> => {
        const flat: Record<string, unknown> = {};
        cfg.steps.forEach((step, idx) => {
            getOrderedFields(step).forEach(field => {
                const val = stepsData?.[idx]?.[field.fieldName];
                flat[field.fieldName] = val ?? field.defaultValue ?? null;
            });
        });
        return flat;
    };

    const loadValidationRulesForConfig = async (configurationId?: string) => {
        if (!configurationId) return;
        try {
            const rules = await fieldValidationRuleClient.getByFormConfigurationId(Number(configurationId));
            const map: Record<number, FieldValidationRuleDto[]> = {};
            rules.forEach(rule => {
                if (!map[rule.formFieldId]) {
                    map[rule.formFieldId] = [];
                }
                map[rule.formFieldId].push(rule);
            });
            setValidationRules(map);
        } catch (err) {
            console.error('Failed to load validation rules:', err);
        }
    };

    const interpolatePlaceholders = (message?: string, placeholders?: { [key: string]: string }) => {
        if (!message) return '';
        if (!placeholders) return message;
        return Object.entries(placeholders).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), message);
    };

    const buildFormContextData = (cfg: FormConfigurationDto, stepsData: AllStepsData): Record<string, unknown> => {
        return flattenAllStepsData(cfg, stepsData);
    };

    const findFieldById = (fieldId: number): { field: FormFieldDto; stepIndex: number } | null => {
        if (!config) return null;
        for (let i = 0; i < config.steps.length; i++) {
            const found = config.steps[i].fields.find(f => f.id && Number(f.id) === fieldId);
            if (found) {
                return { field: found, stepIndex: i };
            }
        }
        return null;
    };

    const triggerFieldValidation = (
        field: FormFieldDto,
        fieldValue: unknown,
        stepsData: AllStepsData,
        debounce = true
    ) => {
        const fieldId = field.id ? Number(field.id) : NaN;
        if (!fieldId || Number.isNaN(fieldId)) return;
        const rules = validationRules[fieldId] || [];
        if (rules.length === 0 || !config) return;

        const runValidation = async () => {
            setValidationLoading(prev => ({ ...prev, [fieldId]: true }));
            try {
                const normalizedSteps = normalizeAllStepsData(config, stepsData);
                const contextData = buildFormContextData(config, normalizedSteps);
                
                // NEW: Extract dependency value if any rule has a dependency
                let dependencyValue: unknown = undefined;
                const rulesForField = validationRules[fieldId] || [];
                if (rulesForField.length > 0 && rulesForField[0].dependsOnFieldId) {
                    const rule = rulesForField[0];
                    const dependencyFieldName = rule.dependsOnField?.fieldName;
                    
                    if (dependencyFieldName) {
                        // CRITICAL: Pass the full entity object, NOT the extracted property
                        // The validation method needs access to all properties for error messages and nested extraction
                        // The validator will handle extracting the specific property using DependencyPath
                        dependencyValue = contextData[dependencyFieldName];
                    }
                }
                
                console.log(`[VALIDATION_TRACE] Validating field ${fieldId} (${field.fieldName})`, {
                    fieldValue,
                    dependencyValue,
                    stepsData,
                    normalizedSteps,
                    formContextData: contextData,
                    validationRulesForField: validationRules[fieldId]
                });
                
                const result = await fieldValidationRuleClient.validateField({
                    fieldId,
                    fieldValue,
                    dependencyValue,
                    formContextData: contextData
                });
                console.log(`[VALIDATION_TRACE] Field ${fieldId} validation result:`, result);
                
                // CRITICAL: Always store the validation result, not just on error
                setValidationResults(prev => ({ ...prev, [fieldId]: result }));
                
                if (result.isValid) {
                    setErrors(prev => {
                        const copy = { ...prev };
                        delete copy[field.fieldName];
                        return copy;
                    });
                } else if (result.isBlocking) {
                    const message = interpolatePlaceholders(result.message, result.placeholders) || `${field.label} failed validation`;
                    setErrors(prev => ({ ...prev, [field.fieldName]: message }));
                }
            } catch (err) {
                console.error('Validation execution failed:', err);
                const fallback: ValidationResultDto = { isValid: false, isBlocking: true, message: 'Validation failed to execute.' };
                setValidationResults(prev => ({ ...prev, [fieldId]: fallback }));
                setErrors(prev => ({ ...prev, [field.fieldName]: fallback.message || `${field.label} failed validation` }));
            } finally {
                setValidationLoading(prev => ({ ...prev, [fieldId]: false }));
            }
        };

        if (debounce) {
            const existing = validationTimersRef.current[fieldId];
            if (existing) {
                window.clearTimeout(existing);
            }
            validationTimersRef.current[fieldId] = window.setTimeout(runValidation, 300);
        } else {
            void runValidation();
        }
    };

    const revalidateDependents = (changedFieldId: number, stepsData: AllStepsData) => {
        const dependentFieldIds = Object.entries(validationRules)
            .filter(([_, rules]) => rules.some(r => r.dependsOnFieldId === changedFieldId))
            .map(([fieldId]) => Number(fieldId));

        dependentFieldIds.forEach(targetId => {
            const target = findFieldById(targetId);
            if (!target) return;
            const targetValue = stepsData[target.stepIndex]?.[target.field.fieldName];
            triggerFieldValidation(target.field, targetValue, stepsData, true);
        });
    };

    /**
     * Phase 5.2: Pre-resolve placeholders for WorldTask integration
     * Fetches and resolves all placeholders from validation rules for the field
     * Returns a dictionary of placeholder names to resolved values
     */
    const resolvePlaceholdersForField = useCallback(async (
        fieldId: number,
        stepsData: AllStepsData
    ): Promise<Record<string, string>> => {
        const rules = validationRules[fieldId] || [];
        if (rules.length === 0 || !config) {
            return {};
        }

        const normalizedSteps = normalizeAllStepsData(config, stepsData);
        const allPlaceholders: Record<string, string> = {};

        // Build Layer 0 placeholders from form context
        const layer0Placeholders = buildPlaceholderContext(config, normalizedSteps);
        Object.assign(allPlaceholders, layer0Placeholders);

        // For each validation rule, resolve placeholders if not already resolved
        for (const rule of rules) {
            try {
                const response = await fieldValidationRuleClient.resolvePlaceholders({
                    fieldValidationRuleId: rule.id,
                    entityTypeName: entityName,
                    entityId: entityId ? Number(entityId) : null,
                    placeholderPaths: [], // Let backend extract from rule's messages
                    currentEntityPlaceholders: layer0Placeholders
                });

                // Merge resolved placeholders
                if (response.resolvedPlaceholders) {
                    Object.assign(allPlaceholders, response.resolvedPlaceholders);
                }

                // Log any resolution errors for debugging
                if (response.unresolvedPlaceholders && response.unresolvedPlaceholders.length > 0) {
                    console.warn('Unresolved placeholders for rule', rule.id, ':', response.unresolvedPlaceholders);
                }
            } catch (error) {
                console.error('Failed to resolve placeholders for rule', rule.id, ':', error);
                // Fail-open: continue even if placeholder resolution fails
            }
        }

        return allPlaceholders;
    }, [validationRules, config, entityName, entityId, normalizeAllStepsData]);

    const runValidationsForStep = async (step: FormStepDto, stepsData: AllStepsData, stepIndex: number) => {
        if (!config) return [] as Array<{ fieldId: number; result: ValidationResultDto }>;
        const targets = getOrderedFields(step)
            .map(f => ({ field: f, fieldId: f.id ? Number(f.id) : NaN }))
            .filter(item => !Number.isNaN(item.fieldId) && (validationRules[item.fieldId]?.length || 0) > 0);

        if (targets.length === 0) return [] as Array<{ fieldId: number; result: ValidationResultDto }>;

        const normalizedSteps = normalizeAllStepsData(config, stepsData);
        const contextData = buildFormContextData(config, normalizedSteps);

        return Promise.all(
            targets.map(async ({ field, fieldId }) => {
                setValidationLoading(prev => ({ ...prev, [fieldId]: true }));
                try {
                    const value = normalizedSteps[stepIndex]?.[field.fieldName];
                    const result = await fieldValidationRuleClient.validateField({ fieldId, fieldValue: value, formContextData: contextData });
                    setValidationResults(prev => ({ ...prev, [fieldId]: result }));
                    if (result.isValid) {
                        setErrors(prev => {
                            const copy = { ...prev };
                            delete copy[field.fieldName];
                            return copy;
                        });
                    } else if (result.isBlocking) {
                        const message = interpolatePlaceholders(result.message, result.placeholders) || `${field.label} failed validation`;
                        setErrors(prev => ({ ...prev, [field.fieldName]: message }));
                    }
                    return { fieldId, result };
                } catch (err) {
                    console.error('Validation execution failed:', err);
                    const fallback: ValidationResultDto = { isValid: false, isBlocking: true, message: 'Validation failed to execute.' };
                    setValidationResults(prev => ({ ...prev, [fieldId]: fallback }));
                    setErrors(prev => ({ ...prev, [field.fieldName]: fallback.message || `${field.label} failed validation` }));
                    return { fieldId, result: fallback };
                } finally {
                    setValidationLoading(prev => ({ ...prev, [fieldId]: false }));
                }
            })
        );
    };

    const loadJoinEntityMetadata = async (cfg: FormConfigurationDto) => {
        const joinEntityTypes = Array.from(
            new Set(
                cfg.steps
                    .filter(step => step.isManyToManyRelationship && step.joinEntityType)
                    .map(step => step.joinEntityType!)
            )
        );

        if (joinEntityTypes.length === 0) {
            setJoinEntityMetadataMap({});
            return;
        }

        try {
            const metadataList = await Promise.all(
                joinEntityTypes.map(type => metadataClient.getEntityMetadata(type))
            );
            const map = metadataList.reduce<Record<string, EntityMetadataDto>>((acc, metadata) => {
                acc[metadata.entityName] = metadata;
                return acc;
            }, {});
            setJoinEntityMetadataMap(map);
        } catch (error) {
            console.error('Failed to load join entity metadata:', error);
            setJoinEntityMetadataMap({});
        }
    };

    const loadConfiguration = React.useCallback(async () => {
        try {
            setLoading(true);
            // CRITICAL: Use initialEntityId prop directly, not the state variable
            // The state update hasn't propagated yet when this effect runs
            const currentEntityId = initialEntityId;
            
            if (existingProgressId) {
                const progress = await formSubmissionClient.getById(existingProgressId);
                setProgressId(progress.id);
                
                // CRITICAL: Restore entityId from progress if it exists (edit mode)
                if (progress.entityId) {
                    setEntityId(progress.entityId);
                }

                const fetchedCfg = await formConfigClient.getById(progress.formConfigurationId);
                setConfig(fetchedCfg);
                void loadValidationRulesForConfig(fetchedCfg.id);
                await loadJoinEntityMetadata(fetchedCfg);

                const parsedCurrent = JSON.parse(progress.currentStepDataJson || '{}');
                const parsedAll = JSON.parse(progress.allStepsDataJson || '{}');
                const mergedAll = mergeChildProgressesIntoManyToManySteps(
                    fetchedCfg,
                    parsedAll,
                    progress.childProgresses || []
                );

                // Ensure all fields present with null/defaults
                setCurrentStepData(
                    normalizeStepData(
                        fetchedCfg.steps[progress.currentStepIndex],
                        mergedAll[progress.currentStepIndex] || parsedCurrent
                    )
                );
                setAllStepsData(normalizeAllStepsData(fetchedCfg, mergedAll));

                // Load entity metadata for normalization
                if (progress.entityTypeName) {
                    const metadata = await metadataClient.getEntityMetadata(progress.entityTypeName);
                    setEntityMetadata(metadata);
                }
            } else {
                if (!entityName) {
                    throw new Error('Entity name is required to load form configuration');
                }
                let fetchedConfig: FormConfigurationDto;
                
                // Use specific config if provided, otherwise fetch default
                if (formConfigurationId) {
                    fetchedConfig = await formConfigClient.getById(formConfigurationId);
                } else {
                    fetchedConfig = await formConfigClient.getByEntityTypeName(entityName, true).then((config: FormConfigurationDto | FormConfigurationDto[] | undefined) => {
                        if (!config) {
                            throw new Error(`No default form configuration found for entity: ${entityName}`);
                        }
                        if (Array.isArray(config)) {
                            throw new Error(`Expected single form configuration but received array for entity: ${entityName}`);
                        }
                        return config;
                    });
                }
                setConfig(fetchedConfig);
                void loadValidationRulesForConfig(fetchedConfig.id);
                await loadJoinEntityMetadata(fetchedConfig);
                
                // changed: if entityId provided, load existing entity data
                if (currentEntityId) {
                    setEntityId(currentEntityId); // Update state for use in other places
                    await loadExistingEntityData(entityName, currentEntityId, fetchedConfig);
                } else {
                    // Initialize all fields for step 0 to default/null
                    const initialData: StepData = normalizeStepData(fetchedConfig.steps[0], {});
                    setCurrentStepData(initialData);

                    // Initialize allStepsData for all steps
                    setAllStepsData(normalizeAllStepsData(fetchedConfig, {} as AllStepsData));
                }

                // Load entity metadata for normalization
                const metadata = await metadataClient.getEntityMetadata(entityName);
                setEntityMetadata(metadata);
            }
        } catch (error) {
            console.error('Failed to load form configuration:', error);
            logging.errorHandler.next('ErrorMessage.UIConfigurations.LoadFailed');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityName, existingProgressId, initialEntityId, formConfigurationId]);

    useEffect(() => {
        loadConfiguration();
    }, [loadConfiguration]);

    // Load workflow step progress if workflow session is active
    useEffect(() => {
        const fetchProgress = async () => {
            if (!workflowSessionId) return;
            try {
                const steps: StepProgressReadDto[] = await workflowClient.getProgress(workflowSessionId);
                const set = new Set<number>();
                steps.filter(s => (s.status || '').toLowerCase() === 'completed')
                     .forEach(s => set.add(s.stepIndex));
                setCompletedSteps(set);
            } catch {
                // ignore errors; non-blocking
            }
        };
        void fetchProgress();
    }, [workflowSessionId]);

    // Phase 5.2: Pre-resolve placeholders for WorldTask fields when step changes
    useEffect(() => {
        if (!currentStepIndex || !config) return;

        const step = config.steps[currentStepIndex];
        if (!step) return;

        const orderedFields = getOrderedFields(step);
        const worldTaskFields = orderedFields.filter(f => {
            const { enabled } = parseWorldTaskSettings(f.settingsJson);
            return enabled && f.id;
        });

        // Pre-resolve placeholders for all WorldTask fields on this step
        worldTaskFields.forEach(field => {
            const fieldId = Number(field.id);
            // Only resolve if not already resolved
            if (!preResolvedPlaceholders[fieldId]) {
                void resolvePlaceholdersForField(fieldId, allStepsData)
                    .then(placeholders => {
                        setPreResolvedPlaceholders(prev => ({ ...prev, [fieldId]: placeholders }));
                    })
                    .catch(err => {
                        // Fail-open: if placeholder resolution fails, continue anyway
                        console.error(`Failed to pre-resolve placeholders for field ${fieldId}:`, err);
                    });
            }
        });
    }, [currentStepIndex, config, allStepsData, preResolvedPlaceholders, resolvePlaceholdersForField]);

    // changed: simplified using utility function
    const loadExistingEntityData = async (entityTypeName: string, id: string, cfg: FormConfigurationDto) => {
        try {
            const entityData: Record<string, unknown> = await getFetchByIdFunctionForEntity(entityTypeName)(id);
            
            const populatedStepsData: AllStepsData = {};
            cfg.steps.forEach((step, stepIndex) => {
                const stepData: StepData = {};
                getOrderedFields(step).forEach(field => {
                    // Use utility function for case-insensitive lookup
                    const value = findValueByFieldName(entityData, field.fieldName);
                    stepData[field.fieldName] = value !== undefined ? value : (field.defaultValue ?? null);
                });
                populatedStepsData[stepIndex] = stepData;
            });

            setAllStepsData(populatedStepsData);
            setCurrentStepData(populatedStepsData[0] || normalizeStepData(cfg.steps[0], {}));
        } catch (error) {
            console.error('Failed to load existing entity data:', error);
            logging.errorHandler.next(`ErrorMessage.${entityTypeName}.LoadFailed`);
            const initialData: StepData = normalizeStepData(cfg.steps[0], {});
            setCurrentStepData(initialData);
            setAllStepsData(normalizeAllStepsData(cfg, {} as AllStepsData));
        }
    };

    const currentStep = config?.steps[currentStepIndex];
    const orderedFields = getOrderedFields(currentStep);

    const computeStepKey = (step: FormStepDto, index: number): string => {
        const key = step.stepName?.trim();
        return key && key.length > 0 ? key : `step-${index + 1}`;
    };

    const parseWorldTaskSettings = (settingsJson?: string): { enabled?: boolean; taskType?: string } => {
        if (!settingsJson) return {};
        try {
            const parsed = JSON.parse(settingsJson);
            if (parsed && typeof parsed === 'object' && parsed.worldTask) {
                return {
                    enabled: !!parsed.worldTask.enabled,
                    taskType: parsed.worldTask.taskType
                };
            }
        } catch {}
        return {};
    };

    /**
     * Handler for validating join entity fields in many-to-many relationships.
     * Called by ManyToManyRelationshipEditor when a join field changes.
     */
    const handleValidateJoinEntityField = async (fieldId: number, value: unknown, _relationshipIndex: number): Promise<void> => {
        const field = findFieldById(fieldId);
        if (!field) return;
        
        // Trigger validation with context from all steps
        triggerFieldValidation(field.field, value, allStepsData, false);
    };

    const handleFieldChange = (fieldName: string, value: unknown) => {
        if (!currentStep) return;

        const mergedCurrent = { ...currentStepData, [fieldName]: value };
        const normalizedCurrent = normalizeStepData(currentStep, mergedCurrent);
        const updatedAllData: AllStepsData = { ...allStepsData, [currentStepIndex]: normalizedCurrent };

        setCurrentStepData(mergedCurrent);
        setAllStepsData(updatedAllData);

        if (errors[fieldName]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }

        const field = currentStep.fields.find(f => f.fieldName === fieldName);
        if (field) {
            triggerFieldValidation(field, value, updatedAllData, true);
            if (field.id) {
                revalidateDependents(Number(field.id), updatedAllData);
            }
        }
    };

    // added: open child form modal for creating new object
    const handleOpenChildForm = (field: FormFieldDto) => {
        setChildFormModal({
            open: true,
            entityTypeName: field.objectType || '',
            fieldName: field.fieldName
        });
    };

    // added: close child form modal
    const handleCloseChildForm = () => {
        setChildFormModal(prev => ({ ...prev, open: false }));
    };

    // added: handle child form completion and data insertion
    const handleChildFormComplete = async (childData: Record<string, unknown>, progress?: FormSubmissionProgressDto) => {
        const fieldName = childFormModal.fieldName;

        try {
            // Extract ID from the created entity if it exists
            // The normalizeFormSubmission will handle the conversion from navigation property to foreign key
            // but we want to store the full object in the form state for display purposes
            const createdEntity = childData;

            console.log(`Child form completed for field: ${fieldName}`, {
                entityType: childFormModal.entityTypeName,
                childData: createdEntity,
                extractedId: createdEntity?.id
            });

            // If this is a child form (has parentProgressId), save to childProgresses
            if (!progress?.parentProgressId && parentProgressId && progressId && currentStepIndex !== undefined) {
                // Save child progress to parent's childProgresses array
                const childProgress: FormSubmissionProgressDto = {
                    id: undefined,
                    formConfigurationId: config!.id!,
                    userId,
                    entityTypeName: childFormModal.entityTypeName,
                    currentStepIndex: 0,
                    currentStepDataJson: JSON.stringify(childData),
                    allStepsDataJson: JSON.stringify({ 0: childData }),
                    parentProgressId: parentProgressId,
                    status: FormSubmissionStatus.Completed
                };

                // Create the child progress in the backend
                await formSubmissionClient.create(childProgress);

                // Insert the entity data into the field
                // Store the full object for display, normalizeFormSubmission will extract ID when submitting
                setCurrentStepData(prev => ({
                    ...prev,
                    [childFormModal.fieldName]: createdEntity
                }));
            } else {
                // Regular child form: insert data directly into the field
                // Store the full object for display, normalizeFormSubmission will extract ID when submitting
                setCurrentStepData(prev => ({
                    ...prev,
                    [fieldName]: createdEntity
                }));
            }

            handleCloseChildForm();
        } catch (error) {
            console.error('Failed to complete child form:', error);
            logging.errorHandler.next('ErrorMessage.FormSubmission.ChildFormFailed');
        }
    };

    const updateManyToManyStepData = (stepIndex: number, fieldName: string, relationships: Array<Record<string, unknown>>) => {
        const updatedAll: AllStepsData = {
            ...allStepsData,
            [stepIndex]: {
                ...(allStepsData[stepIndex] || {}),
                [fieldName]: relationships
            }
        };

        if (stepIndex === currentStepIndex) {
            setCurrentStepData(prev => ({
                ...prev,
                [fieldName]: relationships
            }));
        }

        setAllStepsData(updatedAll);
    };

    const handleOpenJoinEntry = async (relationshipIndex: number) => {
        if (!config || !currentStep?.isManyToManyRelationship) return;
        if (!currentStep.joinEntityType || !currentStep.subConfigurationId) return;
        if (relationshipIndex < 0) return;

        let parentId = progressId;
        if (!parentId) {
            const saved = await saveProgress(FormSubmissionStatus.InProgress);
            parentId = saved?.id;
        }

        if (!parentId) {
            setError('Unable to create a draft for join entries. Please try again.');
            return;
        }

        const fieldName = currentStep.relatedEntityPropertyName || 'relationships';
        const relationships = (allStepsData[currentStepIndex]?.[fieldName] || currentStepData[fieldName] || []) as Array<Record<string, unknown>>;
        const selectedRelationship = relationships[relationshipIndex];
        if (!selectedRelationship) {
            setError('Please select a related entity before creating a join entry.');
            return;
        }
        const existingProgressId = selectedRelationship?.__childProgressId as string | undefined;

        setJoinEntryModal({
            open: true,
            stepIndex: currentStepIndex,
            relationshipIndex,
            joinEntityType: currentStep.joinEntityType,
            joinConfigurationId: currentStep.subConfigurationId,
            parentProgressId: parentId,
            existingProgressId
        });
    };

    const handleCloseJoinEntryModal = () => {
        setJoinEntryModal(prev => ({ ...prev, open: false }));
    };

    const handleJoinEntryComplete = async (joinData: Record<string, unknown>, progress?: FormSubmissionProgressDto) => {
        if (!config || joinEntryModal.stepIndex === null || joinEntryModal.relationshipIndex === null) {
            handleCloseJoinEntryModal();
            return;
        }

        const step = config.steps[joinEntryModal.stepIndex];
        const fieldName = step.relatedEntityPropertyName || 'relationships';
        const relationships = (allStepsData[joinEntryModal.stepIndex]?.[fieldName] || currentStepData[fieldName] || []) as Array<Record<string, unknown>>;

        const updatedRelationships = [...relationships];
        const existingRelationship = updatedRelationships[joinEntryModal.relationshipIndex] || {};
        const relatedEntityId = existingRelationship.relatedEntityId;
        const relatedEntity = existingRelationship.relatedEntity;

        const mergedRelationship: Record<string, unknown> = {
            ...existingRelationship,
            ...joinData,
            relatedEntityId,
            relatedEntity
        };

        if (progress?.id) {
            mergedRelationship.__childProgressId = progress.id;
        }

        updatedRelationships[joinEntryModal.relationshipIndex] = mergedRelationship;
        updateManyToManyStepData(joinEntryModal.stepIndex, fieldName, updatedRelationships);

        if (progress?.id && joinEntryModal.parentProgressId && relatedEntityId !== undefined) {
            try {
                const parsedCurrent = JSON.parse(progress.currentStepDataJson || '{}') as Record<string, unknown>;
                const parsedAll = JSON.parse(progress.allStepsDataJson || '{}') as Record<string, Record<string, unknown>>;
                const updatedAll = Object.fromEntries(
                    Object.entries(parsedAll).map(([key, value]) => [key, { ...value, relatedEntityId }])
                );

                await formSubmissionClient.update({
                    ...progress,
                    parentProgressId: joinEntryModal.parentProgressId,
                    currentStepDataJson: JSON.stringify({ ...parsedCurrent, relatedEntityId }),
                    allStepsDataJson: JSON.stringify(updatedAll)
                });
            } catch (error) {
                console.error('Failed to update join entry progress:', error);
            }
        }

        handleCloseJoinEntryModal();
    };

    const validateField = (field: FormFieldDto): string | null => {
        const value = currentStepData[field.fieldName];

        if (field.isRequired && (value === null || value === undefined || value === '')) {
            return `${field.label} is required`;
        }

        for (const validation of field.validations) {
            if (!validation.isActive) continue;

            // Parse validation parameters if needed (commented: validation logic placeholder)
            // const params = validation.parametersJson ? JSON.parse(validation.parametersJson) : {};
            
            // Add validation logic based on ValidationType
            // For brevity, showing Required only
        }

        return null;
    };

    const validateStep = (): boolean => {
        const newErrors: { [fieldName: string]: string } = {};
        let isValid = true;

        orderedFields.forEach(field => {
            // Check dependency conditions
            if (field.dependencyConditionJson) {
                const conditionMet = ConditionEvaluator.evaluateConditions(
                    field.dependencyConditionJson,
                    currentStepData,
                    allStepsData
                );
                if (!conditionMet) return; // Skip validation if field is hidden
            }

            const error = validateField(field);
            if (error) {
                newErrors[field.fieldName] = error;
                isValid = false;
                return;
            }

            // CRITICAL: Only check validation results for fields that actually exist on current step
            // and have a fieldId. Fields from other steps should not block progression.
            const fieldId = field.id ? Number(field.id) : undefined;
            if (fieldId && currentStep?.fields.some(f => f.id === field.id)) {
                const validationResult = validationResults[fieldId];
                if (validationResult && !validationResult.isValid && validationResult.isBlocking) {
                    newErrors[field.fieldName] =
                        interpolatePlaceholders(validationResult.message, validationResult.placeholders) || `${field.label} failed validation`;
                    isValid = false;
                }
            }
        });

        setErrors(newErrors);
        // changed: clear page-level error when validating fields
        if (isValid) {
            setError(null);
        }
        return isValid;
    };

    const getProgressData = (): FormSubmissionProgressDto | null => {
        const mergedAllSteps = { ...allStepsData, [currentStepIndex]: normalizeStepData(config!.steps[currentStepIndex], currentStepData) };
        const progressData: FormSubmissionProgressDto = {
                id: progressId,
                formConfigurationId: config!.id!,
                userId,
                entityTypeName: entityName,
                entityId: entityId, // CRITICAL: preserve entityId for edit mode
                currentStepIndex,
                currentStepDataJson: JSON.stringify(normalizeStepData(config!.steps[currentStepIndex], currentStepData)),
                allStepsDataJson: JSON.stringify(mergedAllSteps),
                parentProgressId: parentProgressId,
                status: FormSubmissionStatus.InProgress,
                updatedAt: new Date().toISOString(),
            };
        return progressData;
    };

    const saveProgress = async (status: FormSubmissionStatus = FormSubmissionStatus.Paused): Promise<FormSubmissionProgressDto | null> => {
        try {
            setSaving(true);
            // changed: clear error before attempting save
            setError(null);

            const progressData = getProgressData();
            if (!progressData) {
                throw new Error('No progress data to save');
            }
            progressData.status = status;

            let savedProgress: FormSubmissionProgressDto;
            if (progressId) {
                savedProgress = await formSubmissionClient.update(progressData);
            } else {
                savedProgress = await formSubmissionClient.create(progressData);
                setProgressId(savedProgress.id);
            }
            // Only surface modal feedback for explicit draft saves to avoid interrupting step navigation
            if (status === FormSubmissionStatus.Paused) {
                setSaveFeedback({
                    open: true,
                    title: 'Progress saved',
                    message: 'Your draft has been saved. You can continue later.',
                    status: 'success'
                });
                clearAutoClose();
                autoCloseRef.current = window.setTimeout(() => {
                    closeSaveModal();
                }, 3000);
            }

            return savedProgress;
        } catch (error: unknown) {
            console.error('Failed to save progress:', error);
            // changed: set user-friendly error message from API or fallback
            const errorMessage = 
                (error && typeof error === 'object' && 'response' in error && 
                 error.response && typeof error.response === 'object' && 'data' in error.response &&
                 error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data &&
                 typeof error.response.data.message === 'string')
                    ? error.response.data.message
                    : 'Failed to save your progress. Please try again.';
            setError(errorMessage);
            logging.errorHandler.next('ErrorMessage.FormSubmission.SaveFailed');
            if (status === FormSubmissionStatus.Paused) {
                setSaveFeedback({
                    open: true,
                    title: 'Save failed',
                    message: errorMessage,
                    status: 'error'
                });
                clearAutoClose();
            }
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        if (!validateStep()) return;

        // Check step completion conditions
        if (currentStep?.conditions) {
            for (const condition of currentStep.conditions) {
                if (condition.conditionType === 'Completion' && condition.isActive) {
                    const met = ConditionEvaluator.evaluateConditions(
                        condition.conditionJson,
                        currentStepData,
                        { ...allStepsData, [currentStepIndex]: currentStepData }
                    );
                    if (!met) {
                        logging.errorHandler.next(condition.errorMessage || 'Step completion conditions not met');
                        return;
                    }
                }
            }
        }

        // Ensure current step includes all fields
        const normalizedCurrent = normalizeStepData(currentStep!, currentStepData);
        const updatedAllData = { ...allStepsData, [currentStepIndex]: normalizedCurrent };

        const validationResultsForStep = await runValidationsForStep(currentStep!, updatedAllData, currentStepIndex);
        const hasBlockingValidation = validationResultsForStep.some(r => !r.result.isValid && r.result.isBlocking);
        if (hasBlockingValidation) {
            setError('Please resolve validation errors before continuing.');
            return;
        }

        setAllStepsData(updatedAllData);

        if (currentStepIndex < config!.steps.length - 1) {
            const saved = await saveProgress(FormSubmissionStatus.InProgress);
            if (!saved) return;

            // Advance and initialize next step data to defaults/nulls
            setCurrentStepIndex(prev => {
                const nextIndex = prev + 1;
                // notify workflow about step advancement (complete current step)
                try {
                    const stepKey = computeStepKey(currentStep!, prev);
                    onStepAdvanced?.({ from: prev, to: nextIndex, stepKey });
                    setCompletedSteps(prevSet => new Set<number>([...Array.from(prevSet), prev]));
                } catch {}
                setCurrentStepData(normalizeStepData(config!.steps[nextIndex], updatedAllData[nextIndex] || {}));
                setErrors({});
                // CRITICAL: Clear validation results when advancing to prevent contamination from previous steps
                setValidationResults({});
                return nextIndex;
            });
        } else {
            const saved = await saveProgress(FormSubmissionStatus.Completed);
            if (!saved) return;

            // Flatten to get all field values
            const normalizedAll = normalizeAllStepsData(config!, updatedAllData);
            const flattenedDto = flattenAllStepsData(config!, normalizedAll);

            // changed: normalize the form data before sending to API
            // This converts nested objects (e.g., parentCategory) to foreign keys (e.g., parentCategoryId)
            let normalizedPayload: Record<string, unknown>;

            try {
                normalizedPayload = normalizeFormSubmission({
                    entityTypeName: entityName,
                    formConfiguration: config!,
                    rawFormValue: flattenedDto,
                    entityMetadata: entityMetadata?.fields || [],
                    joinEntityMetadataMap
                });
            } catch (normalizeError) {
                const message = normalizeError instanceof Error
                    ? normalizeError.message
                    : 'Unable to prepare your submission. Please review the join entries and try again.';
                setError(message);
                return;
            }

            // CRITICAL: Include entity ID in payload for edit mode
            // This ensures the parent component calls UPDATE instead of CREATE
            if (entityId) {
                normalizedPayload.id = entityId;
            }

            console.log('Raw form data (flattened):', flattenedDto);
            console.log('Normalized payload for API (with IDs extracted):', normalizedPayload);
            console.log('Edit mode:', !!entityId, 'Entity ID:', entityId);

            // notify workflow for final step as well
            try {
                const stepKey = computeStepKey(currentStep!, currentStepIndex);
                onStepAdvanced?.({ from: currentStepIndex, to: currentStepIndex, stepKey });
                setCompletedSteps(prevSet => new Set<number>([...Array.from(prevSet), currentStepIndex]));
            } catch {}

            onComplete?.(normalizedPayload, getProgressData()!);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setError(null);
            // Persist normalized current step before going back
            setAllStepsData(prev => ({ ...prev, [currentStepIndex]: normalizeStepData(currentStep!, currentStepData) }));
            setCurrentStepIndex(prev => {
                const previousIndex = prev - 1;
                setCurrentStepData(normalizeStepData(config!.steps[previousIndex], allStepsData[previousIndex] || {}));
                setErrors({});
                // CRITICAL: Clear validation results when retreating to prevent contamination from previous steps
                setValidationResults({});
                return previousIndex;
            });
        }
    };

    // changed: add explicit save draft handler
    const handleSaveDraft = async () => {
        const saved = await saveProgress(FormSubmissionStatus.Paused);
        if (saved) {
            // Optional: show success message
            console.log('Draft saved successfully');
        }
    };

    // changed: update form title to indicate edit mode
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading form...</p>
                </div>
            </div>
        );
    }

    if (!config || !currentStep) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">No form configuration found for {entityName}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header Section: Progress Bar, Title, and Navigation */}
            <div className="px-6 md:px-8 pt-6 md:pt-8 pb-4 md:pb-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
                {/* added: error banner */}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    </div>
                )}

                {/* Progress Indicator */}
                <div className="flex items-center justify-center mx-auto mb-6 w-full max-w-3xl px-2 md:px-4 gap-3 md:gap-4">
                    {config.steps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                            <div
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                                    (index < currentStepIndex || completedSteps.has(index))
                                        ? 'bg-green-500 text-white'
                                        : index === currentStepIndex
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                            >
                                {(index < currentStepIndex || completedSteps.has(index)) ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : index + 1}
                            </div>
                            {index < config.steps.length - 1 && (
                                <div
                                    className={`h-1 w-10 md:w-16 rounded-full transition-colors flex-shrink-0 ${
                                        (index < currentStepIndex || completedSteps.has(index)) ? 'bg-green-500' : 'bg-gray-200'
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Title and Description */}
                <div className="text-center mb-6">
                    {/* changed: show edit mode in title */}
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                        {entityId ? `Edit ${entityName}` : currentStep.title}
                    </h2>
                    {currentStep.description && (
                        <p className="mt-2 text-sm text-gray-600">{currentStep.description}</p>
                    )}
                </div>

                {/* Navigation Buttons Toolbar */}
                <div className="flex flex-col md:flex-row gap-3 md:gap-2 justify-between items-center">
                    <button
                        onClick={handlePrevious}
                        disabled={currentStepIndex === 0}
                        className="w-full md:w-auto btn-secondary disabled:opacity-50 flex items-center justify-center"
                    >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        Previous
                    </button>

                    <button
                        onClick={handleSaveDraft}
                        className="w-full md:w-auto btn-tertiary flex items-center justify-center"
                    >
                        <Save className="h-5 w-5 mr-2" />
                        Save Draft
                    </button>

                    <button
                        onClick={handleNext}
                        className="w-full md:w-auto btn-primary flex items-center justify-center disabled:opacity-50"
                        disabled={saving}
                    >
                        {saving ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        ) : (
                            <ChevronRight className="h-5 w-5 mr-2" />
                        )}
                        {saving ? 'Submitting...' : currentStepIndex === config.steps.length - 1 ? 'Submit' : 'Next'}
                    </button>
                </div>
            </div>

            {/* Form Fields */}
            <div className="px-6 md:px-8 py-6 md:py-8 space-y-6">
                {currentStep.isManyToManyRelationship ? (
                    /* Many-to-Many Relationship Step */
                    <ManyToManyRelationshipEditor
                        step={currentStep}
                        value={currentStepData[currentStep.relatedEntityPropertyName || 'relationships'] || []}
                        onChange={(value) => handleFieldChange(currentStep.relatedEntityPropertyName || 'relationships', value)}
                        entityName={entityName}
                        joinFormConfigurationId={currentStep.subConfigurationId}
                        onOpenJoinEntry={handleOpenJoinEntry}
                        validationRules={validationRules}
                        validationResults={validationResults}
                        onValidateField={handleValidateJoinEntityField}
                    />
                ) : (
                    /* Standard Field-Based Step */
                    orderedFields.map(field => {
                        const shouldShow = !field.dependencyConditionJson ||
                            ConditionEvaluator.evaluateConditions(
                                field.dependencyConditionJson,
                                currentStepData,
                                allStepsData
                            );

                        if (!shouldShow) return null;

                        // Check if this field has world task enabled
                        const { enabled: worldTaskEnabled, taskType } = parseWorldTaskSettings(field.settingsJson);
                        const stepKey = computeStepKey(currentStep!, currentStepIndex);

                        // If world task is enabled and we have a workflow session, use WorldBoundFieldRenderer
                        if (worldTaskEnabled && workflowSessionId != null && taskType) {
                            // Phase 5.2: Pre-resolve placeholders for this field before rendering
                            const fieldId = field.id ? Number(field.id) : null;
                            const fieldPlaceholders = fieldId ? preResolvedPlaceholders[fieldId] : undefined;
                            
                            // Phase 7+: Get validation rules and prepare form context for WorldTask validation
                            const fieldValidationRules = fieldId ? (validationRules[fieldId] || []) : [];
                            const flatFormValues = config ? flattenAllStepsData(config, allStepsData) : {};
                            
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                            const WorldBoundFieldRenderer = require('../Workflow/WorldBoundFieldRenderer').WorldBoundFieldRenderer;
                            return (
                                <WorldBoundFieldRenderer
                                    key={field.id}
                                    field={field}
                                    value={currentStepData[field.fieldName]}
                                    onChange={(value: any) => handleFieldChange(field.fieldName, value)}
                                    taskType={taskType}
                                    workflowSessionId={workflowSessionId}
                                    stepNumber={currentStepIndex}
                                    stepKey={stepKey}
                                    fieldId={fieldId || undefined}
                                    formContext={currentStepData}
                                    formConfiguration={config} // Phase 7: Pass form configuration for dependency resolution
                                    validationRules={fieldValidationRules} // Phase 7+: Pass validation rules
                                    currentFormValues={flatFormValues} // Phase 7+: Pass all form values for validation context
                                    preResolvedPlaceholders={fieldPlaceholders}
                                    allowExisting={false}
                                    allowCreate={true}
                                    onTaskCompleted={(task: any, extractedValue: any) => {
                                        console.log('WorldTask completed:', task, 'Extracted value:', extractedValue);
                                        
                                        // Clear the previous validation result for this field so it re-validates fresh
                                        // with the newly populated value (prevents blocking on stale validation state)
                                        console.log('Clearing validation result for fieldId:', fieldId);
                                        console.log('Current validation results before clearing:', validationResults);
                                        if (fieldId) {
                                            setValidationResults(prev => {
                                                const updated = { ...prev };
                                                delete updated[fieldId];
                                                console.log('Updated validation results after clearing:', updated);
                                                return updated;
                                            });
                                            // Clear any error messages for this field as well
                                            setErrors(prev => {
                                                const updated = { ...prev };
                                                delete updated[field.fieldName];
                                                return updated;
                                            });
                                        }
                                        
                                        // Field value already updated via onChange callback
                                        // Optionally notify workflow about step advancement
                                        onStepAdvanced?.({ from: currentStepIndex, to: currentStepIndex, stepKey });
                                    }}
                                />
                            );
                        }

                        // Otherwise use standard field renderer
                        return (
                            <FieldRenderer
                                key={field.id}
                                field={field}
                                value={currentStepData[field.fieldName]}
                                onChange={value => handleFieldChange(field.fieldName, value)}
                                error={errors[field.fieldName]}
                                onBlur={() => validateField(field)}
                                onCreateNew={() => handleOpenChildForm(field)}
                                validationResult={field.id ? validationResults[Number(field.id)] : undefined}
                                validationPending={field.id ? validationLoading[Number(field.id)] : false}
                            />
                        );
                    })
                )}
            </div>

            {/* Feedback and Child Form Modals */}
            <FeedbackModal
                open={saveFeedback.open}
                title={saveFeedback.title}
                message={saveFeedback.message}
                status={saveFeedback.status}
                onClose={closeSaveModal}
                onContinue={closeSaveModal}
            />

            {/* added: child form modal for creating objects on-the-fly */}
            <ChildFormModal
                open={childFormModal.open}
                entityTypeName={childFormModal.entityTypeName}
                parentProgressId={progressId}
                userId={userId}
                fieldName={childFormModal.fieldName}
                currentStepIndex={currentStepIndex}
                onComplete={handleChildFormComplete}
                onClose={handleCloseChildForm}
            />

            <JoinEntityFormModal
                open={joinEntryModal.open}
                entityTypeName={joinEntryModal.joinEntityType}
                formConfigurationId={joinEntryModal.joinConfigurationId}
                parentProgressId={joinEntryModal.parentProgressId}
                userId={userId}
                existingProgressId={joinEntryModal.existingProgressId}
                onComplete={handleJoinEntryComplete}
                onClose={handleCloseJoinEntryModal}
            />
        </div>
    );
};

