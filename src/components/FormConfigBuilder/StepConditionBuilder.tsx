import React from 'react';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import {
    DependencyCondition,
    FormFieldDto,
    ParsedStepCondition,
    StepConditionDto
} from '../../types/dtos/forms/FormModels';
import { FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { ConditionOperator, FieldType } from '../../utils/enums';
import { STEP_CONDITION_NO_VALUE_OPERATORS, STEP_CONDITION_OPERATORS } from '../../utils/conditionEvaluator';
import { SourceFieldOption } from '../../utils/forms/displayConditionSources';
import {
    STEP_CONDITION_OPERATOR_LABELS,
    StepConditionType,
    defaultStepConditionValue,
    describeStepCondition,
    parseStepConditionJson,
    serializeStepCondition,
    stepConditionCountLabel,
    stepConditionNeedsMessage
} from '../../utils/forms/stepConditions';

interface StepConditionBuilderProps {
    /** `Step "Region and access"`, for the card's one-line explanation. */
    stepLabel: string;
    conditions: StepConditionDto[];
    /** This step's own fields, in form order. */
    stepFields: FormFieldDto[];
    /** The fields of the steps before this one (a rule can read those with "from an earlier step"). */
    earlierFields: SourceFieldOption[];
    metadataFields: FieldMetadataDto[];
    onChange: (conditions: StepConditionDto[]) => void;
}

const WHEN_LABELS: Record<StepConditionType, string> = {
    Completion: 'Before leaving this step (Next / Submit)',
    Entry: 'Before entering this step'
};

const INPUT = 'rounded-md border-field shadow-sm focus:border-primary focus:ring-primary sm:text-sm';

/**
 * Step conditions in the form builder (PandiO/knk-workspace#88): what must hold before the wizard lets
 * the user leave a step (Completion) or open it (Entry). Each condition is a list of rules over the
 * step's fields, or the fields of earlier steps, stored as `ParsedStepCondition` JSON in
 * `conditionJson` — the shape `ConditionEvaluator.evaluateConditions` reads. JSON that is not that
 * shape is shown as text and saved as it is.
 */
export const StepConditionBuilder: React.FC<StepConditionBuilderProps> = ({
    stepLabel,
    conditions,
    stepFields,
    earlierFields,
    metadataFields,
    onChange
}) => {
    const list = conditions || [];

    // One entry per field name: a field shared by several earlier steps is one choice.
    const earlierFieldList = earlierFields.reduce<FormFieldDto[]>((acc, option) => {
        if (!acc.some(f => f.fieldName === option.field.fieldName)) acc.push(option.field);
        return acc;
    }, []);

    const fieldsFor = (fromPreviousStep?: boolean): FormFieldDto[] => (fromPreviousStep ? earlierFieldList : stepFields);
    const findField = (row: DependencyCondition): FormFieldDto | undefined =>
        fieldsFor(row.fromPreviousStep).find(f => f.fieldName === row.fieldName);
    const labelFor = (row: DependencyCondition): string => {
        const field = findField(row);
        return field ? field.label || field.fieldName : row.fieldName;
    };

    const enumValuesFor = (field: FormFieldDto | undefined): string[] | null => {
        if (!field) return null;
        const meta = metadataFields.find(m => m.fieldName.toLowerCase() === field.fieldName.toLowerCase());
        if (meta?.enumValues && meta.enumValues.length > 0) return meta.enumValues;
        if (field.fieldType === FieldType.Enum) {
            const legacy = (field.defaultValue || field.placeholder || '').split(',').map(v => v.trim()).filter(Boolean);
            return legacy.length > 0 ? legacy : null;
        }
        return null;
    };

    const update = (index: number, patch: Partial<StepConditionDto>) =>
        onChange(list.map((c, i) => (i === index ? { ...c, ...patch } : c)));

    const updateRows = (index: number, parsed: ParsedStepCondition, rows: DependencyCondition[], logic = parsed.logic) =>
        update(index, { conditionJson: serializeStepCondition(rows, logic ?? 'AND') });

    const newRow = (type: StepConditionType): DependencyCondition | null => {
        // An Entry condition is checked before the step is filled in, so it normally reads earlier steps.
        const fromPrevious = type === 'Entry' ? earlierFieldList.length > 0 : stepFields.length === 0;
        const field = fieldsFor(fromPrevious)[0];
        if (!field) return null;
        return {
            fieldName: field.fieldName,
            operator: ConditionOperator.Equals,
            value: defaultStepConditionValue(field),
            ...(fromPrevious ? { fromPreviousStep: true } : {})
        };
    };

    const addCondition = () => {
        const first = newRow('Completion');
        onChange([
            ...list,
            {
                conditionType: 'Completion',
                conditionJson: serializeStepCondition(first ? [first] : [], 'AND'),
                errorMessage: '',
                isActive: true
            }
        ]);
    };

    const noFields = stepFields.length === 0 && earlierFieldList.length === 0;

    const renderValueInput = (
        name: string,
        row: DependencyCondition,
        setValue: (value: unknown) => void
    ) => {
        if (STEP_CONDITION_NO_VALUE_OPERATORS.includes(row.operator)) {
            return <span className="text-xs text-muted italic self-center">no value needed</span>;
        }
        const field = findField(row);

        if (field?.fieldType === FieldType.Boolean) {
            // A real boolean, never the text "true": Equals compares with ===.
            return (
                <label className="flex items-center gap-1 text-sm text-fg">
                    <input
                        type="checkbox"
                        aria-label={`${name}: value`}
                        checked={row.value === true}
                        onChange={e => setValue(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-field rounded"
                    />
                    {row.value === true ? 'ticked' : 'not ticked'}
                </label>
            );
        }

        const enumValues = enumValuesFor(field);
        if (enumValues) {
            return (
                <select
                    aria-label={`${name}: value`}
                    value={row.value === null || row.value === undefined ? '' : String(row.value)}
                    onChange={e => setValue(e.target.value === '' ? null : e.target.value)}
                    className={`flex-1 min-w-0 ${INPUT}`}
                >
                    <option value="">-- select value --</option>
                    {enumValues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            );
        }

        const isNumeric = field?.fieldType === FieldType.Integer || field?.fieldType === FieldType.Decimal;
        return (
            <input
                type={isNumeric ? 'number' : 'text'}
                aria-label={`${name}: value`}
                value={row.value === null || row.value === undefined ? '' : String(row.value)}
                onChange={e => setValue(
                    e.target.value === '' ? null : (isNumeric ? Number(e.target.value) : e.target.value)
                )}
                className={`flex-1 min-w-0 ${INPUT}`}
            />
        );
    };

    const renderRows = (index: number, condition: StepConditionDto, parsed: ParsedStepCondition) => {
        const rows = parsed.conditions;
        const setRow = (rowIndex: number, next: DependencyCondition) =>
            updateRows(index, parsed, rows.map((r, i) => (i === rowIndex ? next : r)));

        return (
            <div className="space-y-2">
                {rows.length >= 2 && (
                    <div className="flex items-center gap-2 text-xs text-muted">
                        <span>match</span>
                        <select
                            aria-label={`Condition ${index + 1}: match all or any`}
                            value={parsed.logic === 'OR' ? 'OR' : 'AND'}
                            onChange={e => updateRows(index, parsed, rows, e.target.value as 'AND' | 'OR')}
                            className="rounded-md border-field text-xs"
                        >
                            <option value="AND">all</option>
                            <option value="OR">any</option>
                        </select>
                        <span>of:</span>
                    </div>
                )}

                {rows.map((row, rowIndex) => {
                    const name = `Condition ${index + 1} rule ${rowIndex + 1}`;
                    const options = fieldsFor(row.fromPreviousStep);
                    const known = options.some(f => f.fieldName === row.fieldName);
                    return (
                        <div key={rowIndex} className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    aria-label={`${name}: field`}
                                    aria-invalid={!known}
                                    value={row.fieldName}
                                    onChange={e => {
                                        const field = options.find(f => f.fieldName === e.target.value);
                                        setRow(rowIndex, { ...row, fieldName: e.target.value, value: defaultStepConditionValue(field) });
                                    }}
                                    className={`flex-1 min-w-[10rem] rounded-md shadow-sm sm:text-sm ${
                                        known ? 'border-field' : 'border-danger text-danger-strong'
                                    }`}
                                >
                                    {!known && <option value={row.fieldName}>{row.fieldName} (missing)</option>}
                                    {options.map(f => (
                                        <option key={f.fieldName} value={f.fieldName}>{f.label || f.fieldName}</option>
                                    ))}
                                </select>

                                <select
                                    aria-label={`${name}: operator`}
                                    value={row.operator}
                                    onChange={e => setRow(rowIndex, { ...row, operator: e.target.value as ConditionOperator })}
                                    className="rounded-md border-field shadow-sm sm:text-sm"
                                >
                                    {STEP_CONDITION_OPERATORS.map(op => (
                                        <option key={op} value={op}>{STEP_CONDITION_OPERATOR_LABELS[op]}</option>
                                    ))}
                                </select>

                                {renderValueInput(name, row, value => setRow(rowIndex, { ...row, value }))}

                                <button
                                    type="button"
                                    onClick={() => updateRows(index, parsed, rows.filter((_, i) => i !== rowIndex))}
                                    className="text-danger hover:text-danger-strong"
                                    aria-label={`Remove ${name.toLowerCase()}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <label className="flex items-center gap-1 text-xs text-muted">
                                <input
                                    type="checkbox"
                                    aria-label={`${name}: from an earlier step`}
                                    checked={!!row.fromPreviousStep}
                                    disabled={!row.fromPreviousStep && earlierFieldList.length === 0}
                                    onChange={e => {
                                        const fromPrevious = e.target.checked;
                                        const field = fieldsFor(fromPrevious)[0];
                                        setRow(rowIndex, {
                                            fieldName: field?.fieldName ?? row.fieldName,
                                            operator: row.operator,
                                            value: defaultStepConditionValue(field),
                                            ...(fromPrevious ? { fromPreviousStep: true } : {})
                                        });
                                    }}
                                />
                                from an earlier step
                            </label>
                            {!known && (
                                <p role="alert" className="text-xs text-danger-strong">
                                    The field "{row.fieldName}" is no longer {row.fromPreviousStep ? 'on an earlier step' : 'on this step'} (renamed or
                                    removed), so this rule can never hold. Pick another field or remove the rule.
                                </p>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={() => {
                        const row = newRow(condition.conditionType);
                        if (row) updateRows(index, parsed, [...rows, row]);
                    }}
                    disabled={noFields}
                    className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center"
                >
                    <Plus className="h-3 w-3 mr-1" /> Add rule
                </button>

                <p className="text-xs text-muted" data-testid={`step-condition-summary-${index}`}>
                    <span className="font-medium">In words:</span> {describeStepCondition(parsed, labelFor)}
                </p>
            </div>
        );
    };

    return (
        <div className="bg-surface border border-line rounded-lg p-4 space-y-3" data-testid="step-condition-builder">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted" />
                        Step conditions
                        <span className="text-xs font-normal text-muted" data-testid="step-condition-count">
                            {stepConditionCountLabel(list)}
                        </span>
                    </h4>
                    <p className="text-xs text-muted">
                        {list.length === 0
                            ? `${stepLabel} can always be opened and left.`
                            : `${stepLabel} can only be left, or opened, when the conditions below hold.`}
                    </p>
                </div>
                <button type="button" onClick={addCondition} className="btn-secondary text-xs flex items-center">
                    <Plus className="h-4 w-4 mr-1" /> Add condition
                </button>
            </div>

            {noFields && list.length > 0 && (
                <p className="text-xs text-warning-strong bg-warning-soft border border-warning-line rounded p-2">
                    This step and the steps before it have no fields yet, so there is nothing for a rule to read.
                </p>
            )}

            {list.map((condition, index) => {
                const parsed = parseStepConditionJson(condition.conditionJson);
                const needsMessage = stepConditionNeedsMessage(condition);
                const off = condition.isActive === false;
                return (
                    <div
                        key={index}
                        className={`border rounded-md p-3 space-y-2 ${off ? 'border-line bg-surface-alt opacity-80' : 'border-line bg-surface-alt'}`}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <select
                                aria-label={`Condition ${index + 1}: when`}
                                value={condition.conditionType}
                                onChange={e => update(index, { conditionType: e.target.value as StepConditionType })}
                                className="flex-1 min-w-[12rem] rounded-md border-field text-sm"
                            >
                                <option value="Completion">{WHEN_LABELS.Completion}</option>
                                <option value="Entry">{WHEN_LABELS.Entry}</option>
                            </select>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-xs text-muted">
                                    <input
                                        type="checkbox"
                                        aria-label={`Condition ${index + 1}: active`}
                                        checked={!off}
                                        onChange={e => update(index, { isActive: e.target.checked })}
                                    />
                                    active
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onChange(list.filter((_, i) => i !== index))}
                                    className="text-danger hover:text-danger-strong"
                                    aria-label={`Remove condition ${index + 1}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {off && <p className="text-xs text-muted">Switched off: the form skips this condition.</p>}

                        <div>
                            <label className="block text-xs font-medium text-fg mb-1" htmlFor={`step-condition-message-${index}`}>
                                Message {condition.conditionType === 'Completion' && <span className="text-danger">*</span>}
                            </label>
                            <input
                                id={`step-condition-message-${index}`}
                                type="text"
                                value={condition.errorMessage || ''}
                                placeholder="What the form says when this condition fails"
                                aria-invalid={needsMessage}
                                onChange={e => update(index, { errorMessage: e.target.value })}
                                className={`block w-full rounded-md px-2 py-1 shadow-sm sm:text-sm ${
                                    needsMessage ? 'border-danger' : 'border-field'
                                } focus:border-primary focus:ring-primary`}
                            />
                            {needsMessage && (
                                <p role="alert" className="mt-1 text-xs text-danger-strong">
                                    Add a message: the form shows it when the condition fails. Needed before you can publish.
                                </p>
                            )}
                        </div>

                        {parsed ? (
                            renderRows(index, condition, parsed)
                        ) : (
                            <div>
                                <label className="block text-xs font-medium text-fg mb-1" htmlFor={`step-condition-json-${index}`}>
                                    Condition JSON
                                </label>
                                <textarea
                                    id={`step-condition-json-${index}`}
                                    value={condition.conditionJson}
                                    rows={4}
                                    onChange={e => update(index, { conditionJson: e.target.value })}
                                    className="block w-full rounded-md border-field shadow-sm font-mono text-xs focus:border-primary focus:ring-primary"
                                />
                                <p className="mt-1 text-xs text-warning-strong">
                                    This condition was not made with the rule editor (hand-written or older JSON), so it is shown as
                                    text and saved as it is.
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
