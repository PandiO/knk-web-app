import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { FieldRenderer } from '../FormWizard/FieldRenderers';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';
import { previewFormValues } from '../../utils/configBuilder/previewData';
import { PreviewRecordSource, PreviewSource } from './PreviewRecordSource';

type Row = Record<string, unknown>;

export interface FormPreviewProps {
    config: FormConfigurationDto;
    entityLabel: string;
}

/** The steps in the order the wizard shows them (stepOrderJson by GUID, else `order`). */
export function orderedSteps(config: FormConfigurationDto): FormStepDto[] {
    const steps = [...(config.steps ?? [])];
    try {
        const order: string[] = config.stepOrderJson ? JSON.parse(config.stepOrderJson) : [];
        if (order.length > 0 && steps.every(s => s.stepGuid && order.includes(s.stepGuid))) {
            return steps.sort((a, b) => order.indexOf(a.stepGuid!) - order.indexOf(b.stepGuid!));
        }
    } catch {
        // fall back to order
    }
    return steps.sort((a, b) => a.order - b.order);
}

/** A step's fields in its saved order (fieldOrderJson by GUID, else `order`). */
export function orderedFields(step: FormStepDto): FormFieldDto[] {
    const fields = [...step.fields];
    try {
        const order: string[] = step.fieldOrderJson ? JSON.parse(step.fieldOrderJson) : [];
        if (order.length > 0 && fields.every(f => f.fieldGuid && order.includes(f.fieldGuid))) {
            return fields.sort((a, b) => order.indexOf(a.fieldGuid!) - order.indexOf(b.fieldGuid!));
        }
    } catch {
        // fall back to order
    }
    return fields.sort((a, b) => a.order - b.order);
}

const hasConditions = (item: { displayConditionGroups?: unknown[] }) => (item.displayConditionGroups?.length ?? 0) > 0;

/**
 * PandiO/knk-workspace#71 (CRUD-13): the form as the wizard draws it, from the builder's working copy, updated as
 * you edit. Fields work but nothing is saved: no draft, no world task, no Create New. Display conditions are not
 * applied (every field shows, marked "Shown when …").
 */
export const FormPreview: React.FC<FormPreviewProps> = ({ config, entityLabel }) => {
    const steps = useMemo(() => orderedSteps(config), [config]);
    const [stepIndex, setStepIndex] = useState(0);
    const [source, setSource] = useState<PreviewSource>('sample');
    const [record, setRecord] = useState<Row | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({});

    // New values when the source changes; a field added in the builder gets its value, typed values stay.
    const baseValues = useMemo(
        () => (source === 'empty' ? {} : previewFormValues(steps, source === 'record' ? record : null)),
        [steps, source, record]
    );
    useEffect(() => {
        setValues(baseValues);
    }, [source, record]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        setValues(prev => ({ ...baseValues, ...prev }));
    }, [baseValues]);

    useEffect(() => {
        if (stepIndex > Math.max(0, steps.length - 1)) setStepIndex(Math.max(0, steps.length - 1));
    }, [steps.length, stepIndex]);

    const onRecord = useCallback((next: Row | null) => setRecord(next), []);
    const step = steps[stepIndex];

    return (
        <section aria-label="Form preview" className="panel bg-surface p-4 space-y-4" data-testid="form-preview">
            <div className="flex items-start gap-2 text-xs text-muted">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p>Preview of the working copy: nothing you enter here is saved, and in-game tasks and Create New are off.</p>
            </div>
            <PreviewRecordSource
                entityTypeName={config.entityTypeName}
                entityLabel={entityLabel}
                allowEmpty
                source={source}
                onSourceChange={setSource}
                onRecord={onRecord}
            />
            {steps.length === 0 ? (
                <p className="text-sm text-muted">No steps yet. Add a step, or Generate from metadata under More.</p>
            ) : (
                <>
                    <nav aria-label="Preview steps" className="flex items-center justify-between gap-2">
                        <button type="button" className="btn-secondary text-sm" onClick={() => setStepIndex(i => Math.max(0, i - 1))} disabled={stepIndex === 0}>
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Back</span>
                        </button>
                        <label className="min-w-0 flex-1 text-center text-sm text-fg">
                            <span className="sr-only">Step</span>
                            <select
                                className="input w-full max-w-xs px-2 py-1 text-sm"
                                value={stepIndex}
                                onChange={e => setStepIndex(Number(e.target.value))}
                            >
                                {steps.map((s, i) => (
                                    <option key={s.id ?? s.stepGuid ?? i} value={i}>Step {i + 1} of {steps.length}: {s.stepName || 'Unnamed'}</option>
                                ))}
                            </select>
                        </label>
                        <button type="button" className="btn-secondary text-sm" onClick={() => setStepIndex(i => Math.min(steps.length - 1, i + 1))} disabled={stepIndex >= steps.length - 1}>
                            <span className="sr-only sm:not-sr-only">Next</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </nav>
                    {step && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-fg">{step.stepName || 'Unnamed step'}</h2>
                                {step.description && <p className="text-sm text-muted">{step.description}</p>}
                                {hasConditions(step) && <p className="mt-1 text-xs text-warning-strong">Shown only when its conditions are met.</p>}
                            </div>
                            {step.isManyToManyRelationship ? (
                                <p className="rounded-md border border-line bg-surface-alt p-3 text-sm text-muted">
                                    Staff add {step.joinEntityType || 'linked'} entries here
                                    {step.relatedEntityPropertyName ? ` (${step.relatedEntityPropertyName})` : ''}, each with its own small form.
                                </p>
                            ) : (
                                [...orderedFields(step), ...(step.childFormSteps ?? []).flatMap(orderedFields)].map((field, i) => (
                                    <div key={field.id ?? field.fieldGuid ?? `${field.fieldName}-${i}`} className="space-y-1">
                                        <FieldRenderer
                                            field={field}
                                            value={values[field.fieldName]}
                                            onChange={value => setValues(prev => ({ ...prev, [field.fieldName]: value }))}
                                        />
                                        {hasConditions(field) && <p className="text-xs text-warning-strong">Shown only when its conditions are met.</p>}
                                    </div>
                                ))
                            )}
                            {!step.isManyToManyRelationship && step.fields.length === 0 && (step.childFormSteps ?? []).length === 0 && (
                                <p className="text-sm text-muted">This step has no fields yet.</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
};
