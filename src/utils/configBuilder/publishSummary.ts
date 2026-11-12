// PandiO/knk-workspace#71 (CRUD-14): what Publish changes for staff, said before it happens.
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';
import { DisplayConfigurationDto, DisplayFieldDto, DisplaySectionDto } from '../../types/dtos/displayConfig/DisplayModels';

export interface ChangeCount {
    added: string[];
    removed: string[];
    changed: string[];
}

export interface PublishSummary {
    /** The lines of the question, in order ("2 steps added: …"). Empty: nothing differs. */
    lines: string[];
    parts: ChangeCount;
    fields: ChangeCount;
    renamed: { from: string; to: string } | null;
    /** True: becomes the default; false: stops being it; null: no change. */
    defaultChange: boolean | null;
}

interface Node {
    key: string;
    name: string;
    signature: string;
    children: Node[];
}

const isRealId = (id?: string) => !!id && !id.startsWith('temp-');
const keyOf = (id: string | undefined, guid: string | undefined, fallback: string) =>
    isRealId(id) ? `id:${id}` : guid ? `guid:${guid.toLowerCase()}` : `name:${fallback}`;

const stable = (value: unknown): string => JSON.stringify(value, (k, v) =>
    ['id', 'formStepId', 'displaySectionId', 'formConfigurationId', 'displayConfigurationId', 'createdAt', 'updatedAt',
        'hasCompatibilityIssues', 'compatibilityIssues', 'stepLevelIssues', 'fields', 'childFormSteps', 'subSections', 'order']
        .includes(k) ? undefined : v);

function formNodes(steps: FormStepDto[]): Node[] {
    return steps.map(step => ({
        key: keyOf(step.id, step.stepGuid, step.stepName),
        name: step.stepName || 'Unnamed step',
        signature: stable(step),
        children: [...step.fields, ...(step.childFormSteps ?? []).flatMap(c => c.fields)].map((f: FormFieldDto) => ({
            key: keyOf(f.id, f.fieldGuid, f.fieldName),
            name: f.label || f.fieldName || 'Unnamed field',
            signature: stable(f),
            children: [],
        })),
    }));
}

function displayNodes(sections: DisplaySectionDto[]): Node[] {
    const flat: DisplaySectionDto[] = [];
    const visit = (list: DisplaySectionDto[]) => list.forEach(s => { flat.push(s); visit(s.subSections ?? []); });
    visit(sections);
    return flat.map(section => ({
        key: keyOf(section.id, section.sectionGuid, section.sectionName),
        name: section.sectionName || 'Unnamed section',
        signature: stable(section),
        children: section.fields.map((f: DisplayFieldDto) => ({
            key: keyOf(f.id, f.fieldGuid, f.label),
            name: f.label || f.fieldName || 'Unnamed field',
            signature: stable(f),
            children: [],
        })),
    }));
}

function compare(before: Node[], after: Node[]): ChangeCount {
    const old = new Map(before.map(n => [n.key, n]));
    const now = new Map(after.map(n => [n.key, n]));
    return {
        added: after.filter(n => !old.has(n.key)).map(n => n.name),
        removed: before.filter(n => !now.has(n.key)).map(n => n.name),
        changed: after.filter(n => old.has(n.key) && old.get(n.key)!.signature !== n.signature).map(n => n.name),
    };
}

const quoteList = (names: string[], max = 4): string => {
    const shown = names.slice(0, max).map(n => `"${n}"`).join(', ');
    return names.length > max ? `${shown} and ${names.length - max} more` : shown;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describe(count: ChangeCount, one: string, many?: string): string[] {
    const lines: string[] = [];
    if (count.added.length) lines.push(`${plural(count.added.length, one, many)} added: ${quoteList(count.added)}.`);
    if (count.removed.length) lines.push(`${plural(count.removed.length, one, many)} removed: ${quoteList(count.removed)}.`);
    if (count.changed.length) lines.push(`${plural(count.changed.length, one, many)} changed: ${quoteList(count.changed)}.`);
    return lines;
}

function summarize(
    before: { name: string; isDefault: boolean; nodes: Node[]; order: string[] } | null,
    after: { name: string; isDefault: boolean; nodes: Node[]; order: string[] },
    part: string
): PublishSummary {
    const parts = compare(before?.nodes ?? [], after.nodes);
    const fields = compare(before?.nodes.flatMap(n => n.children) ?? [], after.nodes.flatMap(n => n.children));
    const renamed = before && before.name !== after.name ? { from: before.name, to: after.name } : null;
    const defaultChange = (before?.isDefault ?? false) === after.isDefault ? null : after.isDefault;
    const lines = [
        ...describe(parts, part),
        ...describe(fields, 'field'),
    ];
    const reordered = before && parts.added.length === 0 && parts.removed.length === 0
        && before.order.join('|') !== after.order.join('|');
    if (reordered) lines.push(`The ${part}s are in a new order.`);
    if (renamed) lines.push(`Renamed from "${renamed.from}" to "${renamed.to}".`);
    return { lines, parts, fields, renamed, defaultChange };
}

/** Published version (null: never published) against the working copy. */
export function summarizeFormPublish(published: FormConfigurationDto | null, working: FormConfigurationDto): PublishSummary {
    const side = (c: FormConfigurationDto) => {
        const nodes = formNodes(c.steps ?? []);
        return { name: c.configurationName, isDefault: c.isDefault, nodes, order: nodes.map(n => n.key) };
    };
    return summarize(published ? side(published) : null, side(working), 'step');
}

export function summarizeDisplayPublish(published: DisplayConfigurationDto | null, working: DisplayConfigurationDto): PublishSummary {
    const side = (c: DisplayConfigurationDto) => {
        const nodes = displayNodes(c.sections ?? []);
        return { name: c.name, isDefault: c.isDefault, nodes, order: nodes.map(n => n.key) };
    };
    return summarize(published ? side(published) : null, side(working), 'section');
}
