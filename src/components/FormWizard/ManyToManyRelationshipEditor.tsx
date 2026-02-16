import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { FormStepDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
import { FieldRenderer } from './FieldRenderers';
import { metadataClient } from '../../apiClients/metadataClient';
import { FieldValidationRuleDto, ValidationResultDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { fieldValidationRuleClient } from '../../apiClients/fieldValidationRuleClient';

interface Props {
    step: FormStepDto;
    value: Record<string, unknown>[]; // Array of join entity instances
    onChange: (value: Record<string, unknown>[]) => void;
    entityName: string; // Parent entity being edited
    joinFormConfigurationId?: string;
    onOpenJoinEntry?: (relationshipIndex: number) => void;
    // Validation support
    validationRules?: Record<number, FieldValidationRuleDto[]>;
    validationResults?: Record<number, ValidationResultDto>;
    onValidateField?: (fieldId: number, value: unknown, relationshipIndex: number) => Promise<void>;
}

/**
 * Component for editing many-to-many relationships with join entity extra fields.
 * 
 * Displays:
 * 1. PagedEntityTable for selecting related entities
 * 2. Cards showing selected relationships with editable join entity fields
 * 
 * Example: For ItemBlueprint → EnchantmentDefinition relationship:
 * - PagedEntityTable shows available enchantments
 * - Cards show selected enchantments with Level field editor
 */
export const ManyToManyRelationshipEditor: React.FC<Props> = ({
    step,
    value = [],
    onChange,
    entityName,
    joinFormConfigurationId,
    onOpenJoinEntry,
    validationResults = {},
    onValidateField
}) => {
    const [loading, setLoading] = useState(true);
    const [relatedEntityType, setRelatedEntityType] = useState<string>('');
    const [relatedEntityIdField, setRelatedEntityIdField] = useState<string>('');
    const [metadataError, setMetadataError] = useState<string>('');
    const [relationshipErrors, setRelationshipErrors] = useState<Record<number, Record<string, string>>>({});
    const [missingEntityWarnings, setMissingEntityWarnings] = useState<Record<number, string>>({});

    const getRelatedEntityIdField = (relatedType: string, fieldNames: string[]): string | null => {
        const expectedField = `${relatedType}Id`;
        const match = fieldNames.find(name => name.toLowerCase() === expectedField.toLowerCase());
        return match ?? null;
    };

    const loadMetadata = React.useCallback(async () => {
        if (!step.joinEntityType) {
            setLoading(false);
            setRelatedEntityType('');
            setRelatedEntityIdField('');
            setMetadataError('');
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
                } else {
                    setRelatedEntityIdField(idFieldName);
                }
            } else {
                setRelatedEntityType('');
                setRelatedEntityIdField('');
                setMetadataError('Unable to resolve the related entity from join entity metadata. Please verify the join entity configuration.');
            }
        } catch (err) {
            console.error('Failed to load join entity metadata:', err);
            setRelatedEntityType('');
            setRelatedEntityIdField('');
            setMetadataError('Failed to load join entity metadata. Please try again or contact support.');
        } finally {
            setLoading(false);
        }
    }, [step.joinEntityType, entityName]);

    useEffect(() => {
        loadMetadata();
    }, [loadMetadata]);

    // Validate all relationships when value changes to detect missing entities
    useEffect(() => {
        const warnings: Record<number, string> = {};
        
        value.forEach((relationship, index) => {
            // Check if related entity is missing or deleted
            if (!relationship.relatedEntity) {
                warnings[index] = 'Related entity is missing or has been deleted. Please remove and re-add this relationship.';
            } else if (!relationship.relatedEntityId && !relationship[relatedEntityIdField]) {
                warnings[index] = 'Related entity ID is missing. Please remove and re-add this relationship.';
            }
        });

        setMissingEntityWarnings(warnings);
    }, [value, relatedEntityIdField]);

    const handleAddRelationship = (selectedEntities: Record<string, unknown>[]) => {
        if (!relatedEntityIdField) {
            setMetadataError('Join entity mapping is not configured. Please verify join entity metadata before adding relationships.');
            return;
        }

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
    };

    const handleRemoveRelationship = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const handleUpdateRelationship = async (index: number, fieldName: string, fieldValue: unknown) => {
        const updated = [...value];
        updated[index] = {
            ...updated[index],
            [fieldName]: fieldValue
        };
        onChange(updated);

        // Trigger validation for this field if validation is enabled
        const field = findFieldInChildSteps(fieldName);
        if (field?.id && onValidateField) {
            await onValidateField(Number(field.id), fieldValue, index);
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
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading relationship configuration...</p>
            </div>
        );
    }

    if (!step.joinEntityType || !relatedEntityType || !relatedEntityIdField) {
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

    return (
        <div className="space-y-6">
            {/* Section 1: Selected Relationships (Cards) */}
            <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Selected and Current Relationships
                </h3>
                {value.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-300 rounded-md">
                        No relationships selected yet. Use the table below to add relationships.
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
                                                Create Join Entry
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

            {/* Section 2: Entity Selection Table */}
            <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                        Add Relationships
                    </h3>
                    {joinConfigId && onOpenJoinEntry && (
                        <button
                            type="button"
                            className="text-xs font-medium text-primary hover:text-primary-dark disabled:text-gray-400"
                            onClick={() => onOpenJoinEntry(value.length - 1)}
                            disabled={value.length === 0}
                        >
                            Create Join Entry
                        </button>
                    )}
                </div>
                <PagedEntityTable
                    entityTypeName={relatedEntityType}
                    columns={[]} // Will use default columns from registry
                    selectionConfig={{ mode: 'multiple' }}
                    selectedItems={value.map(v => ({ id: v.relatedEntityId }))}
                    onSelectionChange={handleAddRelationship}
                    rowActions={[]}
                />
            </div>
        </div>
    );
};
