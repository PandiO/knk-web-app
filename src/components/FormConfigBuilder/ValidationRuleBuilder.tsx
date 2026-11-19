import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { DraftValidationRuleDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { PathValidationResult } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { DraftRuleInput } from '../../utils/forms/draftValidationRules';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { PathBuilder } from '../PathBuilder/PathBuilder';
import { ParentFormField } from '../../utils/forms/parentFormFields';

interface ValidationRuleBuilderProps {
    field: FormFieldDto;
    availableFields: FormFieldDto[];
    entityTypeName: string;
    entityMetadata: Map<string, EntityMetadataDto>;
    /** PandiO/knk-workspace#291: the rule goes into the builder's draft (keyed by field GUID), not to the API. */
    onSave: (rule: DraftRuleInput) => Promise<void> | void;
    onCancel: () => void;
    initialRule?: DraftValidationRuleDto;
    /** Fields of the forms this form is opened from (findParentFormFields), also offered as dependencies. */
    parentFormFields?: ParentFormField[];
}

/**
 * The dependency select's value: a field of this form by GUID (it may exist only in the draft), a parent form's field
 * by id, or '' for none.
 */
const dependencyKeyOf = (rule?: DraftValidationRuleDto): string => {
    if (rule?.dependsOnFieldGuid) return `field:${rule.dependsOnFieldGuid}`;
    if (rule?.dependsOnFieldId) return `parent:${rule.dependsOnFieldId}`;
    return '';
};

const CONFIG_TEMPLATES: Record<string, { config: unknown; error: string; success?: string; isBlocking?: boolean }> = {
    LocationInsideRegion: {
        config: { regionPropertyPath: 'WgRegionId', allowBoundary: false },
        error: "Location is outside {townName}'s boundaries. Please select a location within the region.",
        success: 'Location is within region boundaries.'
    },
    RegionContainment: {
        config: { parentRegionPath: 'WgRegionId', requireFullContainment: true },
        error: 'Region extends outside parent boundaries. All boundaries must be within {townName}.',
        success: 'Region is fully contained within parent.'
    },
    // P2 (PandiO/knk-workspace#676, production DESIGN § 3.4): placement rules P-2/P-3, checked by the game server's
    // territory lookup. Every placement rule warns by default; an admin can make it blocking.
    InsideTerritory: {
        config: { holderKind: 'Town', holderIdPath: 'Id' },
        error: "The region is not inside {townName}'s territory (or part of it is contested).",
        success: "Inside {townName}'s territory.",
        isBlocking: false
    },
    ConditionalRequired: {
        config: { condition: { op: 'equals', value: true } },
        error: 'This field is required when {dependencyFieldName} is set.',
        success: ''
    }
};

export const ValidationRuleBuilder: React.FC<ValidationRuleBuilderProps> = ({
    field,
    availableFields,
    entityTypeName,
    entityMetadata,
    onSave,
    onCancel,
    initialRule,
    parentFormFields = []
}) => {
    const [validationType, setValidationType] = useState<string>(initialRule?.validationType || 'LocationInsideRegion');
    const [dependencyKey, setDependencyKey] = useState<string>(dependencyKeyOf(initialRule));
    const [dependencyPath, setDependencyPath] = useState<string>(initialRule?.dependencyPath || '');
    const [configJson, setConfigJson] = useState<string>(initialRule?.configJson || '');
    const [errorMessage, setErrorMessage] = useState<string>(initialRule?.errorMessage || '');
    const [successMessage, setSuccessMessage] = useState<string>(initialRule?.successMessage || '');
    const [isBlocking, setIsBlocking] = useState<boolean>(initialRule?.isBlocking ?? true);
    const [requiresDependencyFilled, setRequiresDependencyFilled] = useState<boolean>(initialRule?.requiresDependencyFilled ?? false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [pathError, setPathError] = useState<string | null>(null);
    const [pathValidationResult, setPathValidationResult] = useState<PathValidationResult | null>(null);

    const dependencyOptions = useMemo(() => {
        return availableFields.filter(f => f.fieldGuid && f.fieldGuid !== field.fieldGuid);
    }, [availableFields, field.fieldGuid]);

    // Parent-form fields grouped per form, nearest parent first.
    const parentFormGroups = useMemo(() => {
        const groups = new Map<string, ParentFormField[]>();
        parentFormFields.forEach(item => {
            const key = `${item.depth}|${item.configurationName}`;
            groups.set(key, [...(groups.get(key) ?? []), item]);
        });
        return Array.from(groups.values());
    }, [parentFormFields]);

    const selectedParentField = useMemo(
        () => parentFormFields.find(item => dependencyKey === `parent:${item.field.id}`),
        [parentFormFields, dependencyKey]
    );
    // A dependency path starts at the entity of the form the dependency field is on.
    const pathEntityTypeName = selectedParentField?.entityTypeName ?? entityTypeName;

    const handlePathChange = useCallback((path: string) => {
        setDependencyPath(path);
        setPathError(null);
    }, []);

    const handleValidationStatusChange = useCallback((result: PathValidationResult) => {
        setPathValidationResult(result);
        // Handle both camelCase and PascalCase from backend
        const isValid = (result as any).isValid ?? (result as any).IsValid ?? false;
        const errorMsg = (result as any).error || (result as any).ErrorMessage;
        setPathError(isValid ? null : (errorMsg || 'Dependency path is invalid.'));
    }, []);

    useEffect(() => {
        // Auto-populate template when creating a new rule
        if (initialRule) return;
        const template = CONFIG_TEMPLATES[validationType];
        if (template) {
            setConfigJson(JSON.stringify(template.config, null, 2));
            setErrorMessage(template.error);
            setSuccessMessage(template.success ?? '');
            setIsBlocking(template.isBlocking ?? true);
        }
    }, [validationType, initialRule]);

    useEffect(() => {
        const defaultValidationType = 'LocationInsideRegion';
        const template = CONFIG_TEMPLATES[defaultValidationType];

        setValidationType(initialRule?.validationType || defaultValidationType);
        setDependencyKey(dependencyKeyOf(initialRule));
        setDependencyPath(initialRule?.dependencyPath || '');
        setConfigJson(initialRule?.configJson || JSON.stringify(template.config, null, 2));
        setErrorMessage(initialRule?.errorMessage || template.error);
        setSuccessMessage(initialRule?.successMessage || template.success || '');
        setIsBlocking(initialRule?.isBlocking ?? true);
        setRequiresDependencyFilled(initialRule?.requiresDependencyFilled ?? false);
        setJsonError(null);
        setPathValidationResult(null);
        setPathError(null);
    }, [initialRule]);

    const validateJson = (value: string): boolean => {
        try {
            JSON.parse(value || '{}');
            setJsonError(null);
            return true;
        } catch (err) {
            setJsonError('Config JSON is invalid. Please fix the syntax.');
            return false;
        }
    };

    const handleSave = async () => {
        if (!field.fieldGuid) {
            setJsonError('This field has no GUID yet, so it can\'t have validation rules.');
            return;
        }

        if (!validateJson(configJson)) {
            return;
        }

        if (dependencyKey !== '' && !dependencyPath) {
            setPathError('Dependency path is required when a dependency field is selected.');
            return;
        }

        if (pathValidationResult) {
            // Handle both camelCase and PascalCase from backend
            const isValid = (pathValidationResult as any).isValid ?? (pathValidationResult as any).IsValid ?? false;
            if (!isValid) {
                const errorMsg = (pathValidationResult as any).error || (pathValidationResult as any).ErrorMessage;
                setPathError(errorMsg || 'Dependency path is invalid.');
                return;
            }
        }

        const payload: DraftRuleInput = {
            validationType,
            dependsOnFieldGuid: dependencyKey.startsWith('field:') ? dependencyKey.slice('field:'.length) : null,
            dependsOnFieldId: dependencyKey.startsWith('parent:') ? Number(dependencyKey.slice('parent:'.length)) : null,
            dependencyPath: dependencyPath || null,
            configJson,
            errorMessage: errorMessage.trim(),
            successMessage: successMessage?.trim() || null,
            isBlocking,
            requiresDependencyFilled
        };

        await onSave(payload);
    };

    const renderInfoBanner = () => (
        <div className="flex items-start space-x-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            <InfoIcon />
            <div>
                <p className="font-semibold">Tip: dependency order matters</p>
                <p>Ensure the dependency field appears before this field in the form flow to avoid runtime warnings.</p>
            </div>
        </div>
    );

    const shouldDisablePathBuilder = !dependencyKey || !pathEntityTypeName;
    const isPathMissing = dependencyKey !== '' && !dependencyPath;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{initialRule ? 'Edit Validation Rule' : 'Add Validation Rule'}</h3>
                    <p className="text-sm text-gray-600">Configure cross-field validation for {field.label || field.fieldName}</p>
                </div>
                <button onClick={onCancel} className="text-muted hover:text-gray-600" aria-label="Close">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {renderInfoBanner()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="rule-validation-type" className="block text-sm font-medium text-gray-700 mb-1">Validation Type *</label>
                    <select
                        id="rule-validation-type"
                        value={validationType}
                        onChange={e => setValidationType(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="LocationInsideRegion">Location Inside Region</option>
                        <option value="RegionContainment">Region Containment</option>
                        <option value="InsideTerritory">Inside Territory</option>
                        <option value="ConditionalRequired">Conditional Required</option>
                    </select>
                    {validationType === 'InsideTerritory' && (
                        <p className="mt-1 text-xs text-gray-500" data-testid="rule-type-help">
                            The field's region (or location) must lie inside the territory of the town the dependency
                            field names (holderKind Town or Kingdom). The game server answers it; while it is offline or
                            production.enabled is off the rule is not checked and never blocks a save.
                        </p>
                    )}
                </div>
                <div>
                    <label htmlFor="rule-depends-on" className="block text-sm font-medium text-gray-700 mb-1">Depends On Field</label>
                    <select
                        id="rule-depends-on"
                        value={dependencyKey}
                        onChange={e => {
                            setDependencyKey(e.target.value);
                            setDependencyPath('');
                            setPathValidationResult(null);
                            setPathError(null);
                        }}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="">-- Select dependency field --</option>
                        {parentFormGroups.length === 0 ? (
                            dependencyOptions.map(option => (
                                <option key={option.fieldGuid} value={`field:${option.fieldGuid}`}>
                                    {option.label || option.fieldName}
                                </option>
                            ))
                        ) : (
                            <>
                                <optgroup label="This form">
                                    {dependencyOptions.map(option => (
                                        <option key={option.fieldGuid} value={`field:${option.fieldGuid}`}>
                                            {option.label || option.fieldName}
                                        </option>
                                    ))}
                                </optgroup>
                                {parentFormGroups.map(group => (
                                    <optgroup
                                        key={`${group[0].depth}-${group[0].configurationName}`}
                                        label={`Parent form: ${group[0].configurationName}`}
                                    >
                                        {group.map(item => (
                                            <option key={item.field.id} value={`parent:${item.field.id}`}>
                                                {item.field.label || item.field.fieldName}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </>
                        )}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                        {selectedParentField
                            ? `Taken from the ${selectedParentField.configurationName} form this form is opened from (and from the saved ${selectedParentField.entityTypeName} in server-side checks such as siege readiness).`
                            : 'Dependency must appear earlier in the form, or on a form this one is opened from.'}
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <PathBuilder
                    key={pathEntityTypeName}
                    initialPath={dependencyPath}
                    entityTypeName={pathEntityTypeName}
                    entityMetadata={entityMetadata}
                    onPathChange={handlePathChange}
                    onValidationStatusChange={handleValidationStatusChange}
                    disabled={shouldDisablePathBuilder}
                    label="Dependency Path"
                    required={dependencyKey !== ''}
                    className="border border-gray-200 rounded-md p-3"
                />
                {shouldDisablePathBuilder && (
                    <p className="text-xs text-gray-500">
                        Select a dependency field before building a path.
                    </p>
                )}
                {isPathMissing && !pathError && (
                    <p className="text-xs text-gray-600">
                        Select a valid dependency path before saving.
                    </p>
                )}
                {pathError && (
                    <p className="text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" /> {pathError}
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Configuration (JSON)</label>
                <textarea
                    value={configJson}
                    onChange={e => setConfigJson(e.target.value)}
                    onBlur={e => validateJson(e.target.value)}
                    rows={6}
                    className={`w-full rounded-md border shadow-sm font-mono text-sm ${jsonError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-primary focus:ring-primary'}`}
                    placeholder='{ "regionPropertyPath": "WgRegionId" }'
                />
                {jsonError && (
                    <p className="mt-1 text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" /> {jsonError}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="rule-error-message" className="block text-sm font-medium text-gray-700 mb-1">Error Message *</label>
                    <textarea
                        id="rule-error-message"
                        value={errorMessage}
                        onChange={e => setErrorMessage(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        placeholder="Use placeholders like {townName}, {coordinates}"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Success Message (optional)</label>
                    <textarea
                        value={successMessage}
                        onChange={e => setSuccessMessage(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        placeholder="Shown when validation passes"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center space-x-2 text-sm text-gray-900">
                    <input
                        type="checkbox"
                        checked={isBlocking}
                        onChange={e => setIsBlocking(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <span>Block step progression on validation failure</span>
                </label>
                <label className="flex items-center space-x-2 text-sm text-gray-900">
                    <input
                        type="checkbox"
                        checked={requiresDependencyFilled}
                        onChange={e => setRequiresDependencyFilled(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <span>Require dependency value before validating</span>
                </label>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
                <button onClick={onCancel} className="btn-secondary">
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="btn-primary"
                    disabled={!errorMessage.trim() || !validationType || !!jsonError || !!pathError || isPathMissing}
                >
                    {initialRule ? 'Save Rule' : 'Add Rule'}
                </button>
            </div>
        </div>
    );
};

const InfoIcon: React.FC = () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m2-4h.01M12 18a9 9 0 110-18 9 9 0 010 18z" />
    </svg>
);
