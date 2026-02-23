import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { FormStepDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldRenderer } from './FieldRenderers';
import { ChildFormModal } from './ChildFormModal';
import { metadataClient } from '../../apiClients/metadataClient';
import { getCreateFunctionForEntity, getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { FieldValidationRuleDto, ValidationResultDto } from '../../types/dtos/forms/FieldValidationRuleDtos';

interface Props {
    step: FormStepDto;
    value: Record<string, unknown>[]; // Array of join entity instances
    onChange: (value: Record<string, unknown>[]) => void;
    entityName: string; // Parent entity being edited
    joinFormConfigurationId?: string;
    onOpenJoinEntry?: (relationshipIndex: number) => void;
    userId: string;
    parentProgressId?: string;
    // Validation support
    validationRules?: Record<number, FieldValidationRuleDto[]>;
    validationResults?: Record<number, ValidationResultDto>;
    onValidateField?: (fieldId: number, value: unknown, relationshipIndex: number) => Promise<void>;
}

/**
 * Component for editing many-to-many relationships with join entity extra fields.
 *
 * Displays existing join relationships and supports creating/editing join entries.
 */
export const ManyToManyRelationshipEditor: React.FC<Props> = ({
    step,
    value = [],
    onChange,
    entityName,
    joinFormConfigurationId,
    onOpenJoinEntry,
    userId,
    parentProgressId,
    validationResults = {},
    onValidateField
}) => {
    const debug = (...args: unknown[]) => console.log('[M2M_DEBUG]', ...args);
    const [loading, setLoading] = useState(true);
    const [relatedEntityType, setRelatedEntityType] = useState<string>('');
    const [relatedEntityIdField, setRelatedEntityIdField] = useState<string>('');
    const [metadataError, setMetadataError] = useState<string>('');
    const [relationshipErrors, setRelationshipErrors] = useState<Record<number, Record<string, string>>>({});
    const [missingEntityWarnings, setMissingEntityWarnings] = useState<Record<number, string>>({});
    const [showCreateRelatedModal, setShowCreateRelatedModal] = useState(false);

    const getRelatedEntityIdField = (relatedType: string, fieldNames: string[]): string | null => {
        const expectedField = `${relatedType}Id`;
        const match = fieldNames.find(name => name.toLowerCase() === expectedField.toLowerCase());
        return match ?? null;
    };

    const loadMetadata = React.useCallback(async () => {
        debug('loadMetadata:start', {
            joinEntityType: step.joinEntityType,
            parentEntityName: entityName,
            currentStepName: step.stepName
        });
        if (!step.joinEntityType) {
            setLoading(false);
            setRelatedEntityType('');
            setRelatedEntityIdField('');
            setMetadataError('');
            debug('loadMetadata:skip-no-join-entity-type');
            return;
        }

        try {
            setLoading(true);
            setMetadataError('');
            // Get metadata for the join entity to understand its fields
            const joinMetadata = await metadataClient.getEntityMetadata(step.joinEntityType);

            // Determine the related entity type from join entity metadata
            // Look for navigation properties that aren't the parent entity
            const relatedProp = joinMetadata.fields.find(
                f => f.isRelatedEntity && f.relatedEntityType !== entityName
            );
            if (relatedProp) {
                const resolvedRelatedEntityType = relatedProp.relatedEntityType!;
                setRelatedEntityType(resolvedRelatedEntityType);

                const idFieldName = getRelatedEntityIdField(
                    resolvedRelatedEntityType,
                    joinMetadata.fields.map(field => field.fieldName)
                );

                if (!idFieldName) {
                    setRelatedEntityIdField('');
                    setMetadataError('Unable to resolve the join entity foreign key field from metadata. Please verify the join entity model and metadata.');
                    debug('loadMetadata:missing-related-id-field', {
                        resolvedRelatedEntityType,
                        availableFields: joinMetadata.fields.map(f => f.fieldName)
                    });
                } else {
                    setRelatedEntityIdField(idFieldName);
                    debug('loadMetadata:resolved-related-id-field', {
                        resolvedRelatedEntityType,
                        relatedEntityIdField: idFieldName
                    });
                }

                console.log('[M2M] Metadata resolved', {
                    parentEntity: entityName,
                    joinEntityType: step.joinEntityType,
                    relatedEntityType: resolvedRelatedEntityType,
                    relatedEntityIdField: idFieldName,
                    joinFieldCount: joinMetadata.fields.length
                });
            } else {
                setRelatedEntityType('');
                setRelatedEntityIdField('');
                setMetadataError('Unable to resolve the related entity from join entity metadata. Please verify the join entity configuration.');
                debug('loadMetadata:missing-related-navigation', {
                    joinEntityType: step.joinEntityType,
                    parentEntityName: entityName,
                    availableRelatedFields: joinMetadata.fields
                        .filter(f => f.isRelatedEntity)
                        .map(f => ({ fieldName: f.fieldName, relatedEntityType: f.relatedEntityType }))
                });
            }
        } catch (err) {
            console.error('Failed to load join entity metadata:', err);
            setRelatedEntityType('');
            setRelatedEntityIdField('');
            setMetadataError('Failed to load join entity metadata. Please try again or contact support.');
            debug('loadMetadata:error', err);
        } finally {
            setLoading(false);
            debug('loadMetadata:complete', {
                relatedEntityType,
                relatedEntityIdField
            });
        }
    }, [step.joinEntityType, entityName]);

    useEffect(() => {
        loadMetadata();
    }, [loadMetadata]);

    useEffect(() => {
        console.log('[M2M] Render state', {
            stepName: step.stepName,
            relatedEntityType,
            relatedEntityIdField,
            joinConfigId: joinFormConfigurationId ?? step.subConfigurationId,
            selectedRelationshipCount: value.length,
            metadataError
        });
    }, [
        step.stepName,
        step.subConfigurationId,
        joinFormConfigurationId,
        relatedEntityType,
        relatedEntityIdField,
        value.length,
        metadataError
    ]);

    // Validate all relationships when value changes to detect missing entities
    useEffect(() => {
        const warnings: Record<number, string> = {};
        
        value.forEach((relationship, index) => {
            if (relationship.__pendingJoinEntry) {
                return;
            }

            // Check if related entity is missing or deleted
            if (!relationship.relatedEntity) {
                warnings[index] = 'Related entity is missing or has been deleted. Please remove and re-add this relationship.';
            } else if (!relationship.relatedEntityId && !relationship[relatedEntityIdField]) {
                warnings[index] = 'Related entity ID is missing. Please remove and re-add this relationship.';
            }
        });

        setMissingEntityWarnings(warnings);
        debug('relationshipWarnings:updated', warnings);
    }, [value, relatedEntityIdField]);

    const handleAddRelationship = (selectedEntities: Record<string, unknown>[]) => {
        debug('handleAddRelationship:input', {
            selectedCount: selectedEntities.length,
            selectedEntities,
            existingCount: value.length,
            relatedEntityIdField
        });
        if (!relatedEntityIdField) {
            setMetadataError('Join entity mapping is not configured. Please verify join entity metadata before adding relationships.');
            debug('handleAddRelationship:blocked-no-related-id-field');
            return;
        }

        console.log('[M2M] Selection changed', {
            selectedEntities,
            existingRelationshipCount: value.length,
            relatedEntityIdField
        });

        // Create new join entity instances for each selected related entity
        const newRelationships = selectedEntities
            .filter(entity => !value.some(v => v.relatedEntityId === entity.id))
            .map(entity => ({
                id: undefined, // New relationship
                relatedEntityId: entity.id,
                [relatedEntityIdField]: entity.id,
                relatedEntity: entity, // Store for display
                // Initialize join entity fields from child step defaults
                ...getDefaultJoinEntityFields()
            }));

        onChange([...value, ...newRelationships]);
        debug('handleAddRelationship:output', {
            addedCount: newRelationships.length,
            newRelationships
        });
    };

    const handleRemoveRelationship = (index: number) => {
        debug('handleRemoveRelationship', {
            index,
            relationship: value[index]
        });
        onChange(value.filter((_, i) => i !== index));
    };

    const handleCreateJoinEntry = () => {
        if (!onOpenJoinEntry) {
            return;
        }

        const newRelationship: Record<string, unknown> = {
            id: undefined,
            __pendingJoinEntry: true,
            ...getDefaultJoinEntityFields()
        };

        const newIndex = value.length;
        onChange([...value, newRelationship]);

        window.setTimeout(() => {
            onOpenJoinEntry(newIndex);
        }, 0);

        debug('handleCreateJoinEntry', {
            newIndex,
            newRelationship
        });
    };

    const handleCreateRelatedEntity = async (createdEntity: Record<string, unknown>) => {
        debug('handleCreateRelatedEntity:start', {
            createdEntity,
            relatedEntityType,
                relationshipCount: value.length
        });
        if (!createdEntity || typeof createdEntity !== 'object') {
            debug('handleCreateRelatedEntity:invalid-created-entity', createdEntity);
            return;
        }

        try {
            setMetadataError('');
            let persisted = createdEntity;
            const existingId = persisted.id;

            if (existingId === undefined || existingId === null || existingId === '') {
                const createFn = getCreateFunctionForEntity(relatedEntityType);
                const createdFromApi = await createFn(createdEntity);
                debug('handleCreateRelatedEntity:create-response', createdFromApi);
                if (createdFromApi && typeof createdFromApi === 'object') {
                    persisted = createdFromApi as Record<string, unknown>;
                }

                if (persisted.id === undefined || persisted.id === null || persisted.id === '') {
                    const searchFn = getSearchFunctionForEntity(relatedEntityType);
                    const searchTerm = String(
                        createdEntity.key ?? createdEntity.displayName ?? createdEntity.name ?? ''
                    );

                    if (searchTerm) {
                        const searchResult = await searchFn({
                            page: 1,
                            pageSize: 20,
                            searchTerm,
                            sortBy: undefined,
                            sortDescending: false,
                            filters: {}
                        });
                        debug('handleCreateRelatedEntity:search-fallback-result', {
                            searchTerm,
                            resultCount: searchResult.items.length,
                            items: searchResult.items
                        });

                        const matched = searchResult.items.find((item: Record<string, unknown>) => {
                            const itemKey = String((item as Record<string, unknown>).key ?? '').toLowerCase();
                            const itemDisplayName = String((item as Record<string, unknown>).displayName ?? (item as Record<string, unknown>).name ?? '').toLowerCase();
                            const expectedKey = String(createdEntity.key ?? '').toLowerCase();
                            const expectedDisplayName = String(createdEntity.displayName ?? createdEntity.name ?? '').toLowerCase();

                            return (expectedKey && itemKey === expectedKey) ||
                                (expectedDisplayName && itemDisplayName === expectedDisplayName);
                        }) as Record<string, unknown> | undefined;

                        if (matched) {
                            persisted = matched;
                            debug('handleCreateRelatedEntity:search-fallback-matched', matched);
                        }
                    }
                }
            }

            if (persisted.id === undefined || persisted.id === null || persisted.id === '') {
                setMetadataError(`Created ${relatedEntityType}, but it has no identifier yet. Please select it from the table after refresh.`);
                debug('handleCreateRelatedEntity:missing-id-after-create', {
                    persisted,
                    createdEntity
                });
                return;
            }

            handleAddRelationship([persisted]);
            // Open join-entry editor for the newly added relationship
            if (onOpenJoinEntry) {
                window.setTimeout(() => onOpenJoinEntry(value.length), 0);
            }
            debug('handleCreateRelatedEntity:success', {
                persisted,
                newRelationshipIndex: value.length
            });
        } catch (error) {
            console.error('[M2M] Failed to create related entity:', error);
            setMetadataError(`Failed to create ${relatedEntityType}. Please try again.`);
            debug('handleCreateRelatedEntity:error', error);
        } finally {
            setShowCreateRelatedModal(false);
            debug('handleCreateRelatedEntity:complete', {
                showCreateRelatedModal: false
            });
        }
    };

    const handleUpdateRelationship = async (index: number, fieldName: string, fieldValue: unknown) => {
        debug('handleUpdateRelationship:start', {
            index,
            fieldName,
            fieldValue,
            previousRelationship: value[index]
        });
        const updated = [...value];
        updated[index] = {
            ...updated[index],
            [fieldName]: fieldValue
        };
        onChange(updated);
        debug('handleUpdateRelationship:after-onChange', {
            updatedRelationship: updated[index]
        });

        // Trigger validation for this field if validation is enabled
        const field = findFieldInChildSteps(fieldName);
        if (field?.id && onValidateField) {
            await onValidateField(Number(field.id), fieldValue, index);
            debug('handleUpdateRelationship:validation-triggered', {
                fieldId: field.id,
                index
            });
        }

        // Update local validation state for required fields
        validateJoinEntityField(index, fieldName, fieldValue, field);
    };

    const findFieldInChildSteps = (fieldName: string): FormFieldDto | undefined => {
        for (const childStep of step.childFormSteps) {
            const field = childStep.fields.find(f => f.fieldName === fieldName);
            if (field) return field;
        }
        return undefined;
    };

    const validateJoinEntityField = (relationshipIndex: number, fieldName: string, fieldValue: unknown, field?: FormFieldDto) => {
        if (!field) field = findFieldInChildSteps(fieldName);
        if (!field) return;

        const errors = { ...relationshipErrors };
        if (!errors[relationshipIndex]) {
            errors[relationshipIndex] = {};
        }

        // Required field validation
        if (field.isRequired && (fieldValue === null || fieldValue === undefined || fieldValue === '')) {
            errors[relationshipIndex][fieldName] = `${field.label} is required`;
        } else {
            // Check if we have a validation result for this field
            const fieldId = field.id ? Number(field.id) : undefined;
            if (fieldId) {
                const validationResult = validationResults[fieldId];
                if (validationResult && !validationResult.isValid && validationResult.isBlocking) {
                    errors[relationshipIndex][fieldName] = validationResult.message || `${field.label} failed validation`;
                } else {
                    delete errors[relationshipIndex][fieldName];
                }
            } else {
                delete errors[relationshipIndex][fieldName];
            }
        }

        // Clean up empty error objects
        if (Object.keys(errors[relationshipIndex]).length === 0) {
            delete errors[relationshipIndex];
        }

        setRelationshipErrors(errors);
        debug('validateJoinEntityField:result', {
            relationshipIndex,
            fieldName,
            fieldValue,
            errorsForRelationship: errors[relationshipIndex]
        });
    };

    const getDefaultJoinEntityFields = (): Record<string, unknown> => {
        const defaults: Record<string, unknown> = {};
        
        // Use child steps to determine default values for join entity fields
        step.childFormSteps.forEach(childStep => {
            childStep.fields.forEach(field => {
                if (field.defaultValue !== undefined && field.defaultValue !== null) {
                    defaults[field.fieldName] = field.defaultValue;
                }
            });
        });

        debug('getDefaultJoinEntityFields', defaults);
        return defaults;
    };

    const renderJoinEntityFields = (relationship: Record<string, unknown>, index: number) => {
        const joinConfigId = joinFormConfigurationId ?? step.subConfigurationId;
        if (joinConfigId) {
            return (
                <div className="text-xs text-gray-500 italic">
                    Join entry fields are configured via the linked form. Use “Create Join Entry” to edit details.
                </div>
            );
        }

        if (!step.childFormSteps || step.childFormSteps.length === 0) {
            return <p className="text-xs text-gray-500 italic">No editable fields configured</p>;
        }

        const cardErrors = relationshipErrors[index] || {};
        const hasErrors = Object.keys(cardErrors).length > 0;

        return (
            <div className="space-y-3">
                {step.childFormSteps.map(childStep => (
                    <div key={childStep.id || childStep.stepName}>
                        {childStep.fields.map(field => {
                            const fieldError = cardErrors[field.fieldName];
                            const fieldId = field.id ? Number(field.id) : undefined;
                            const validationResult = fieldId ? validationResults[fieldId] : undefined;
                            
                            return (
                                <div key={field.id || field.fieldName} className="mb-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        {field.label}
                                        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <FieldRenderer
                                        field={field}
                                        value={relationship[field.fieldName]}
                                        onChange={(newValue) => handleUpdateRelationship(index, field.fieldName, newValue)}
                                        error={fieldError}
                                        validationResult={validationResult}
                                    />
                                    {field.description && !fieldError && (
                                        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
                {hasErrors && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-xs text-red-700 font-medium">Please fix the errors above before proceeding.</p>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        debug('render:loading');
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading relationship configuration...</p>
            </div>
        );
    }

    if (!step.joinEntityType || !relatedEntityType || !relatedEntityIdField) {
        debug('render:incomplete-configuration', {
            joinEntityType: step.joinEntityType,
            relatedEntityType,
            relatedEntityIdField,
            metadataError
        });
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                    Many-to-many relationship configuration is incomplete. Please configure the join entity type and related entity property.
                </p>
                {metadataError && (
                    <p className="text-xs text-yellow-700 mt-2">
                        {metadataError}
                    </p>
                )}
            </div>
        );
    }

    const joinConfigId = joinFormConfigurationId ?? step.subConfigurationId;
    debug('render:ready', {
        joinConfigId,
        relatedEntityType,
        relatedEntityIdField,
        selectedRelationshipCount: value.length
    });

    return (
        <div className="space-y-6">
            {metadataError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800">{metadataError}</p>
                </div>
            )}

            {/* Section 1: Selected Relationships (Cards) */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                        Selected and Current Relationships
                    </h3>
                    {joinConfigId && onOpenJoinEntry && (
                        <button
                            type="button"
                            className="text-xs font-medium text-primary hover:text-primary-dark disabled:text-gray-400"
                            onClick={handleCreateJoinEntry}
                            disabled={!relatedEntityType}
                        >
                            Create New Join Entry
                        </button>
                    )}
                </div>
                {value.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-300 rounded-md">
                        No relationships selected yet. Use “Create New Join Entry” to add one.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {value.map((relationship, index) => {
                            const hasMissingEntity = missingEntityWarnings[index];
                            const hasFieldErrors = relationshipErrors[index] && Object.keys(relationshipErrors[index]).length > 0;
                            const cardBorderClass = hasMissingEntity ? 'border-red-300' : hasFieldErrors ? 'border-yellow-300' : 'border-gray-200';
                            
                            return (
                                <div
                                    key={index}
                                    className={`bg-white border ${cardBorderClass} rounded-lg shadow-sm p-4`}
                                >
                                    {hasMissingEntity && (
                                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md flex items-start">
                                            <AlertTriangle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs text-red-700 font-medium">Missing Entity</p>
                                                <p className="text-xs text-red-600 mt-1">{missingEntityWarnings[index]}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-medium text-gray-900">
                                                {(relationship.relatedEntity as { name?: string; displayName?: string })?.name || 
                                                 (relationship.relatedEntity as { name?: string; displayName?: string })?.displayName || 
                                                 `Relationship #${index + 1}`}
                                            </h4>
                                            {(relationship.relatedEntity as { description?: string })?.description && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {(relationship.relatedEntity as { description?: string }).description}
                                                </p>
                                            )}
                                        </div>
                                        {joinConfigId && onOpenJoinEntry && (
                                            <button
                                                onClick={() => onOpenJoinEntry(index)}
                                                className="mr-2 text-xs font-medium text-primary hover:text-primary-dark"
                                                type="button"
                                            >
                                                Edit Join Entry
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRemoveRelationship(index)}
                                            className="p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
                                            title="Remove relationship"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {renderJoinEntityFields(relationship, index)}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>


            <ChildFormModal
                open={showCreateRelatedModal}
                entityTypeName={relatedEntityType}
                parentProgressId={parentProgressId}
                userId={userId}
                fieldName={`__m2m_related_${step.relatedEntityPropertyName || 'relationships'}`}
                currentStepIndex={0}
                onComplete={handleCreateRelatedEntity}
                onClose={() => setShowCreateRelatedModal(false)}
            />
        </div>
    );
};
