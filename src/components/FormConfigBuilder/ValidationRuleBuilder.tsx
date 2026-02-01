import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { CreateFieldValidationRuleDto, FieldValidationRuleDto } from '../../types/dtos/forms/FieldValidationRuleDtos';

interface ValidationRuleBuilderProps {
    field: FormFieldDto;
    availableFields: FormFieldDto[];
    onSave: (rule: CreateFieldValidationRuleDto) => Promise<void> | void;
    onCancel: () => void;
    initialRule?: FieldValidationRuleDto;
}

const CONFIG_TEMPLATES: Record<string, { config: unknown; error: string; success?: string }> = {
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
    ConditionalRequired: {
        config: { condition: { operator: 'equals', value: true } },
        error: 'This field is required when {dependencyFieldName} is set.',
        success: ''
    }
};

export const ValidationRuleBuilder: React.FC<ValidationRuleBuilderProps> = ({
    field,
    availableFields,
    onSave,
    onCancel,
    initialRule
}) => {
    const [validationType, setValidationType] = useState<string>(initialRule?.validationType || 'LocationInsideRegion');
    const [dependsOnFieldId, setDependsOnFieldId] = useState<number | ''>(initialRule?.dependsOnFieldId || '');
    const [configJson, setConfigJson] = useState<string>(initialRule?.configJson || '');
    const [errorMessage, setErrorMessage] = useState<string>(initialRule?.errorMessage || '');
    const [successMessage, setSuccessMessage] = useState<string>(initialRule?.successMessage || '');
    const [isBlocking, setIsBlocking] = useState<boolean>(initialRule?.isBlocking ?? true);
    const [requiresDependencyFilled, setRequiresDependencyFilled] = useState<boolean>(initialRule?.requiresDependencyFilled ?? false);
    const [jsonError, setJsonError] = useState<string | null>(null);

    const dependencyOptions = useMemo(() => {
        return availableFields.filter(f => f.id && f.id !== field.id);
    }, [availableFields, field.id]);

    useEffect(() => {
        // Auto-populate template when creating a new rule
        if (initialRule) return;
        const template = CONFIG_TEMPLATES[validationType];
        if (template) {
            setConfigJson(JSON.stringify(template.config, null, 2));
            setErrorMessage(template.error);
            setSuccessMessage(template.success ?? '');
        }
    }, [validationType, initialRule]);

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
        if (!field.id) {
            setJsonError('Field must be saved before adding validation rules.');
            return;
        }

        if (!validateJson(configJson)) {
            return;
        }

        const payload: CreateFieldValidationRuleDto = {
            formFieldId: parseInt(field.id, 10),
            validationType,
            dependsOnFieldId: dependsOnFieldId === '' ? undefined : Number(dependsOnFieldId),
            configJson,
            errorMessage: errorMessage.trim(),
            successMessage: successMessage?.trim() || undefined,
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

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{initialRule ? 'Edit Validation Rule' : 'Add Validation Rule'}</h3>
                    <p className="text-sm text-gray-600">Configure cross-field validation for {field.label || field.fieldName}</p>
                </div>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {renderInfoBanner()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validation Type *</label>
                    <select
                        value={validationType}
                        onChange={e => setValidationType(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="LocationInsideRegion">Location Inside Region</option>
                        <option value="RegionContainment">Region Containment</option>
                        <option value="ConditionalRequired">Conditional Required</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Depends On Field</label>
                    <select
                        value={dependsOnFieldId}
                        onChange={e => setDependsOnFieldId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="">-- Select dependency field --</option>
                        {dependencyOptions.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.label || option.fieldName}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Dependency must appear earlier in the form.</p>
                </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Error Message *</label>
                    <textarea
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
                    disabled={!errorMessage.trim() || !validationType || !!jsonError}
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
