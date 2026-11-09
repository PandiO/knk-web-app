import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog } from '../Dialog';
import { DataTable, DataTableSection } from '../DataTable';
import { Field } from '../Field';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import {
    displayCandidateProblem, formCandidateProblem, isCovered, planScaffold, SCAFFOLD_GROUP_TITLES, ScaffoldCandidate,
    ScaffoldGroup,
} from '../../utils/configBuilder/scaffold';

export interface ScaffoldDialogProps {
    open: boolean;
    kind: 'form' | 'display';
    meta: EntityMetadataDto | null;
    /** Properties the configuration already has (left out by default). */
    existing: Set<string>;
    onGenerate: (candidates: ScaffoldCandidate[]) => void;
    onClose: () => void;
}

const GROUPS: ScaffoldGroup[] = ['basics', 'references', 'collections'];

/**
 * PandiO/knk-workspace#71 (CRUD-12): "Generate from metadata". Lists the type's properties by group (values, links,
 * collections) with what each becomes; the chosen ones are added as one step or section per group, at the end, for
 * the builder to edit like any other. What can't be generated is listed with the reason.
 */
export const ScaffoldDialog: React.FC<ScaffoldDialogProps> = ({ open, kind, meta, existing, onGenerate, onClose }) => {
    const plan = useMemo(() => (meta ? planScaffold(meta) : { candidates: [], skipped: [] }), [meta]);
    const problemOf = kind === 'form' ? formCandidateProblem : displayCandidateProblem;
    const usable = useMemo(() => plan.candidates.filter(c => !problemOf(c)), [plan, problemOf]);
    const unusable = useMemo(() => [
        ...plan.candidates.filter(c => problemOf(c)).map(c => ({ property: c.property, reason: problemOf(c)! })),
        ...plan.skipped,
    ], [plan, problemOf]);

    const [skipExisting, setSkipExisting] = useState(true);
    const [chosen, setChosen] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (!open) return;
        setChosen(new Set(usable.filter(c => !isCovered(c, existing)).map(c => c.property)));
        setSkipExisting(true);
    }, [open, usable, existing]);

    const shown = usable.filter(c => !skipExisting || !isCovered(c, existing));
    const sections: DataTableSection<ScaffoldCandidate>[] = GROUPS
        .map(group => ({
            key: group,
            label: kind === 'form' ? `${SCAFFOLD_GROUP_TITLES[group].label} → step "${SCAFFOLD_GROUP_TITLES[group].step}"`
                : group === 'collections' ? `${SCAFFOLD_GROUP_TITLES[group].label} → a section each`
                : `${SCAFFOLD_GROUP_TITLES[group].label} → section "${SCAFFOLD_GROUP_TITLES[group].section}"`,
            rows: shown.filter(c => c.group === group).map(c => ({ key: c.property, row: c })),
        }))
        .filter(section => section.rows.length > 0);
    const picked = shown.filter(c => chosen.has(c.property));
    const toggle = (c: ScaffoldCandidate) => setChosen(prev => {
        const next = new Set(prev);
        if (next.has(c.property)) next.delete(c.property); else next.add(c.property);
        return next;
    });
    const allPicked = shown.length > 0 && shown.every(c => chosen.has(c.property));
    const unit = kind === 'form' ? 'step' : 'section';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="3xl"
            title={`Generate from ${meta?.displayName ?? meta?.entityName ?? 'the entity'}`}
            description={`Adds a ${unit} per group with sensible field types, after the ${unit}s you have. Nothing is saved until you press Save.`}
            icon={<Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />}
            footer={(
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto text-sm text-muted" aria-live="polite">{picked.length} of {shown.length} chosen</span>
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-primary" disabled={picked.length === 0} onClick={() => onGenerate(picked)}>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Add {picked.length} field{picked.length === 1 ? '' : 's'}
                    </button>
                </div>
            )}
        >
            {!meta ? (
                <p className="text-sm text-muted">Choose the entity first.</p>
            ) : (
                <div className="space-y-4">
                    <Field label={`Leave out properties this ${kind === 'form' ? 'form' : 'page'} already has`} inline>
                        <input type="checkbox" className="h-4 w-4" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} />
                    </Field>
                    <DataTable<ScaffoldCandidate>
                        caption={`Properties of ${meta.displayName ?? meta.entityName}`}
                        density="compact"
                        sections={sections}
                        selection={{
                            isSelected: c => chosen.has(c.property),
                            onToggle: toggle,
                            onToggleAll: () => setChosen(allPicked ? new Set() : new Set(shown.map(c => c.property))),
                            rowLabel: c => `Add ${c.label}`,
                            allLabel: 'Choose all properties shown',
                        }}
                        columns={[
                            { key: 'label', header: 'Field', cell: c => <span className="font-medium text-fg">{c.label}</span> },
                            { key: 'property', header: 'Property', className: 'font-mono text-xs' },
                            { key: 'becomes', header: 'Becomes' },
                            { key: 'required', header: 'Required', cell: c => (c.required ? 'Yes' : 'No') },
                        ]}
                        empty={skipExisting ? `Every property is already in this ${kind === 'form' ? 'form' : 'page'}.` : 'No properties to add.'}
                    />
                    {unusable.length > 0 && (
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted">Not generated ({unusable.length})</summary>
                            <ul className="mt-2 space-y-1">
                                {unusable.map(skip => (
                                    <li key={skip.property}>
                                        <span className="font-mono text-xs text-fg">{skip.property}</span>
                                        <span className="text-muted">: {skip.reason}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </Dialog>
    );
};
