import React from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import { DisplayConditionDto, DisplayConditionGroupDto } from '../../types/dtos/forms/FormModels';
import { FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { ConditionOperator, DisplayConditionLogic, DisplayConditionTargetType } from '../../utils/enums';
import { FieldType } from '../../utils/enums';
import { SourceFieldOption } from '../../utils/forms/displayConditionSources';

interface DisplayConditionBuilderProps {
    targetLabel: string;
    targetType: DisplayConditionTargetType;
    groups: DisplayConditionGroupDto[];
    /** Only fields that come earlier in the form; enforced again by the API on save. */
    availableSourceFields: SourceFieldOption[];
    metadataFields: FieldMetadataDto[];
    onChange: (groups: DisplayConditionGroupDto[]) => void;
}

const MULTI_VALUE_OPERATORS = [ConditionOperator.In, ConditionOperator.NotIn];
const NO_VALUE_OPERATORS = [ConditionOperator.IsEmpty, ConditionOperator.IsNotEmpty];

const OPERATOR_LABELS: Record<string, string> = {
    [ConditionOperator.Equals]: 'is',
    [ConditionOperator.NotEquals]: 'is not',
    [ConditionOperator.GreaterThan]: '>',
    [ConditionOperator.GreaterOrEqual]: '>=',
    [ConditionOperator.LessThan]: '<',
    [ConditionOperator.LessOrEqual]: '<=',
    [ConditionOperator.In]: 'is one of',
    [ConditionOperator.NotIn]: 'is none of',
    [ConditionOperator.Contains]: 'contains',
    [ConditionOperator.IsEmpty]: 'is empty',
    [ConditionOperator.IsNotEmpty]: 'is not empty'
};

const SELECTABLE_OPERATORS = Object.keys(OPERATOR_LABELS) as ConditionOperator[];

const parseValue = (valueJson: string): unknown => {
    try {
        return JSON.parse(valueJson);
    } catch {
        return valueJson;
    }
};

export const DisplayConditionBuilder: React.FC<DisplayConditionBuilderProps> = ({
    targetLabel,
    targetType,
    groups,
    availableSourceFields,
    metadataFields,
    onChange
}) => {
    const sortedGroups = [...(groups || [])].sort((a, b) => a.order - b.order);

    const findSource = (guid: string): SourceFieldOption | undefined =>
        availableSourceFields.find(o => o.field.fieldGuid === guid);

    const enumValuesFor = (guid: string): string[] | null => {
        const source = findSource(guid);
        if (!source) return null;
        const meta = metadataFields.find(m => m.fieldName.toLowerCase() === source.field.fieldName.toLowerCase());
        if (meta?.enumValues && meta.enumValues.length > 0) return meta.enumValues;
        // Fall back to the legacy comma-separated list some configurations still use.
        if (source.field.fieldType === FieldType.Enum) {
            const legacy = (source.field.defaultValue || source.field.placeholder || '')
                .split(',').map(v => v.trim()).filter(Boolean);
            return legacy.length > 0 ? legacy : null;
        }
        return null;
    };

    const emit = (next: DisplayConditionGroupDto[]) => {
        onChange(next.map((g, index) => ({ ...g, order: index })));
    };

    const addGroup = () => {
        emit([
            ...sortedGroups,
            {
                targetType,
                innerLogic: DisplayConditionLogic.And,
                combineWithPreviousLogic: DisplayConditionLogic.Or,
                order: sortedGroups.length,
                isActive: true,
                conditions: []
            }
        ]);
    };

    const updateGroup = (groupIndex: number, patch: Partial<DisplayConditionGroupDto>) => {
        emit(sortedGroups.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g)));
    };

    const removeGroup = (groupIndex: number) => {
        emit(sortedGroups.filter((_, i) => i !== groupIndex));
    };

    const updateConditions = (groupIndex: number, conditions: DisplayConditionDto[]) => {
        updateGroup(groupIndex, { conditions: conditions.map((c, i) => ({ ...c, order: i })) });
    };

    const addCondition = (groupIndex: number) => {
        const first = availableSourceFields[0];
        if (!first) return;
        updateConditions(groupIndex, [
            ...sortedGroups[groupIndex].conditions,
            {
                sourceFieldGuid: first.field.fieldGuid || '',
                operator: ConditionOperator.Equals,
                valueJson: 'null',
                order: sortedGroups[groupIndex].conditions.length
            }
        ]);
    };

    const renderValueInput = (
        groupIndex: number,
        conditionIndex: number,
        condition: DisplayConditionDto
    ) => {
        if (NO_VALUE_OPERATORS.includes(condition.operator)) {
            return <span className="text-xs text-gray-400 italic self-center">no value needed</span>;
        }

        const setValue = (value: unknown) => {
            const next = [...sortedGroups[groupIndex].conditions];
            next[conditionIndex] = { ...condition, valueJson: JSON.stringify(value ?? null) };
            updateConditions(groupIndex, next);
        };

        const enumValues = enumValuesFor(condition.sourceFieldGuid);
        const current = parseValue(condition.valueJson);
        const isMulti = MULTI_VALUE_OPERATORS.includes(condition.operator);

        if (enumValues) {
            if (isMulti) {
                const selected = Array.isArray(current) ? current.map(String) : [];
                return (
                    <select
                        multiple
                        value={selected}
                        onChange={e => setValue(Array.from(e.target.selectedOptions, o => o.value))}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        {enumValues.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                );
            }

            return (
                <select
                    value={current === null || current === undefined ? '' : String(current)}
                    onChange={e => setValue(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                >
                    <option value="">-- select value --</option>
                    {enumValues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            );
        }

        const source = findSource(condition.sourceFieldGuid);

        if (source?.field.fieldType === FieldType.Boolean && !isMulti) {
            return (
                <select
                    value={current === true ? 'true' : current === false ? 'false' : ''}
                    onChange={e => setValue(e.target.value === '' ? null : e.target.value === 'true')}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                >
                    <option value="">-- select value --</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            );
        }

        const isNumeric = source?.field.fieldType === FieldType.Integer || source?.field.fieldType === FieldType.Decimal;

        if (isMulti) {
            const selected = Array.isArray(current) ? current : [];
            return (
                <input
                    type="text"
                    value={selected.join(', ')}
                    placeholder="comma separated values"
                    onChange={e => setValue(
                        e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                            .map(v => (isNumeric ? Number(v) : v))
                    )}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
            );
        }

        return (
            <input
                type={isNumeric ? 'number' : 'text'}
                value={current === null || current === undefined ? '' : String(current)}
                onChange={e => setValue(
                    e.target.value === '' ? null : (isNumeric ? Number(e.target.value) : e.target.value)
                )}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            />
        );
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-gray-500" />
                        Display Conditions
                    </h4>
                    <p className="text-xs text-gray-600">
                        {sortedGroups.length === 0
                            ? `${targetLabel} is always shown.`
                            : `${targetLabel} is only shown when the rules below are met.`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={addGroup}
                    disabled={availableSourceFields.length === 0}
                    className="btn-secondary text-xs flex items-center disabled:opacity-50"
                >
                    <Plus className="h-4 w-4 mr-1" /> Add group
                </button>
            </div>

            {availableSourceFields.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    No earlier fields available. A display condition can only read a field that comes
                    before this {targetType === DisplayConditionTargetType.FormStep ? 'step' : 'field'}.
                </p>
            )}

            {sortedGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                            {groupIndex > 0 && (
                                <select
                                    value={group.combineWithPreviousLogic}
                                    onChange={e => updateGroup(groupIndex, {
                                        combineWithPreviousLogic: e.target.value as DisplayConditionLogic
                                    })}
                                    className="rounded-md border-gray-300 text-xs"
                                >
                                    <option value={DisplayConditionLogic.Or}>OR previous</option>
                                    <option value={DisplayConditionLogic.And}>AND previous</option>
                                </select>
                            )}
                            <span className="text-gray-500">match</span>
                            <select
                                value={group.innerLogic}
                                onChange={e => updateGroup(groupIndex, { innerLogic: e.target.value as DisplayConditionLogic })}
                                className="rounded-md border-gray-300 text-xs"
                            >
                                <option value={DisplayConditionLogic.And}>all</option>
                                <option value={DisplayConditionLogic.Or}>any</option>
                            </select>
                            <span className="text-gray-500">of:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={group.isActive}
                                    onChange={e => updateGroup(groupIndex, { isActive: e.target.checked })}
                                />
                                active
                            </label>
                            <button
                                type="button"
                                onClick={() => removeGroup(groupIndex)}
                                className="text-red-500 hover:text-red-700"
                                aria-label="Remove group"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {group.conditions.map((condition, conditionIndex) => (
                        <div key={conditionIndex} className="flex items-center gap-2">
                            <select
                                value={condition.sourceFieldGuid}
                                onChange={e => {
                                    const next = [...group.conditions];
                                    next[conditionIndex] = { ...condition, sourceFieldGuid: e.target.value, valueJson: 'null' };
                                    updateConditions(groupIndex, next);
                                }}
                                className="flex-1 rounded-md border-gray-300 shadow-sm sm:text-sm"
                            >
                                {availableSourceFields.map(option => (
                                    <option key={option.field.fieldGuid} value={option.field.fieldGuid}>
                                        {option.stepName} › {option.field.label || option.field.fieldName}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={condition.operator}
                                onChange={e => {
                                    const next = [...group.conditions];
                                    next[conditionIndex] = { ...condition, operator: e.target.value as ConditionOperator };
                                    updateConditions(groupIndex, next);
                                }}
                                className="rounded-md border-gray-300 shadow-sm sm:text-sm"
                            >
                                {SELECTABLE_OPERATORS.map(op => (
                                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                                ))}
                            </select>

                            {renderValueInput(groupIndex, conditionIndex, condition)}

                            <button
                                type="button"
                                onClick={() => updateConditions(groupIndex, group.conditions.filter((_, i) => i !== conditionIndex))}
                                className="text-red-500 hover:text-red-700"
                                aria-label="Remove condition"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={() => addCondition(groupIndex)}
                        disabled={availableSourceFields.length === 0}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                        + Add condition
                    </button>
                </div>
            ))}
        </div>
    );
};
