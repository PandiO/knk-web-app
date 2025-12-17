import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { FormStepDto, FormFieldDto, StepData } from '../../types/dtos/forms/FormModels';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
import { FieldRenderer } from './FieldRenderers';
import { metadataClient } from '../../apiClients/metadataClient';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';

interface Props {
    step: FormStepDto;
    value: any[]; // Array of join entity instances
    onChange: (value: any[]) => void;
    entityName: string; // Parent entity being edited
    allStepsData: { [stepIndex: number]: StepData };
    currentStepIndex: number;
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
    allStepsData,
    currentStepIndex
}) => {
    const [metadata, setMetadata] = useState<EntityMetadataDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [relatedEntityType, setRelatedEntityType] = useState<string>('');

    useEffect(() => {
        loadMetadata();
    }, [step.joinEntityType]);

    const loadMetadata = async () => {
        if (!step.joinEntityType) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Get metadata for the join entity to understand its fields
            const joinMetadata = await metadataClient.getByEntityName(step.joinEntityType);
            setMetadata(joinMetadata);

            // Determine the related entity type from join entity metadata
            // Look for navigation properties that aren't the parent entity
            const relatedProp = joinMetadata.fields.find(
                f => f.isNavigationProperty && f.relatedEntityType !== entityName
            );
            if (relatedProp) {
                setRelatedEntityType(relatedProp.relatedEntityType!);
            }
        } catch (err) {
            console.error('Failed to load join entity metadata:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRelationship = (selectedEntities: any[]) => {
        // Create new join entity instances for each selected related entity
        const newRelationships = selectedEntities
            .filter(entity => !value.some(v => v.relatedEntityId === entity.id))
            .map(entity => ({
                id: undefined, // New relationship
                relatedEntityId: entity.id,
                relatedEntity: entity, // Store for display
                // Initialize join entity fields from child step defaults
                ...getDefaultJoinEntityFields()
            }));

        onChange([...value, ...newRelationships]);
    };

    const handleRemoveRelationship = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const handleUpdateRelationship = (index: number, fieldName: string, fieldValue: any) => {
        const updated = [...value];
        updated[index] = {
            ...updated[index],
            [fieldName]: fieldValue
        };
        onChange(updated);
    };

    const getDefaultJoinEntityFields = (): any => {
        const defaults: any = {};
        
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

    const renderJoinEntityFields = (relationship: any, index: number) => {
        if (!step.childFormSteps || step.childFormSteps.length === 0) {
            return <p className="text-xs text-gray-500 italic">No editable fields configured</p>;
        }

        return (
            <div className="space-y-3">
                {step.childFormSteps.map(childStep => (
                    <div key={childStep.id || childStep.stepName}>
                        {childStep.fields.map(field => (
                            <div key={field.id || field.fieldName} className="mb-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    {field.label}
                                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <FieldRenderer
                                    field={field}
                                    value={relationship[field.fieldName]}
                                    onChange={(newValue) => handleUpdateRelationship(index, field.fieldName, newValue)}
                                    allStepsData={allStepsData}
                                    currentStepIndex={currentStepIndex}
                                    errors={{}}
                                />
                                {field.description && (
                                    <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
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

    if (!step.joinEntityType || !relatedEntityType) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                    Many-to-many relationship configuration is incomplete. Please configure the join entity type and related entity property.
                </p>
            </div>
        );
    }

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
                        {value.map((relationship, index) => (
                            <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg shadow-sm p-4"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-gray-900">
                                            {relationship.relatedEntity?.name || 
                                             relationship.relatedEntity?.displayName || 
                                             `Relationship #${index + 1}`}
                                        </h4>
                                        {relationship.relatedEntity?.description && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {relationship.relatedEntity.description}
                                            </p>
                                        )}
                                    </div>
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
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Entity Selection Table */}
            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Add Relationships
                </h3>
                <PagedEntityTable
                    entityType={relatedEntityType}
                    selectionMode="multiple"
                    onSelectionChange={handleAddRelationship}
                    selectedIds={value.map(v => v.relatedEntityId)}
                    showActions={false}
                />
            </div>
        </div>
    );
};
