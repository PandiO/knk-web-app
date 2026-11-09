// PandiO/knk-workspace#71 (CRUD-12): "Generate from metadata" in the form and display builders.
import { EntityMetadataDto, FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';
import { DisplayFieldDto, DisplaySectionDto } from '../../types/dtos/displayConfig/DisplayModels';
import { FieldType } from '../enums';
import { mapFieldType } from '../fieldTypeMapper';

/** The groups a type's properties fall into; each becomes a step (form) or a section (display). */
export type ScaffoldGroup = 'basics' | 'references' | 'collections';

export const SCAFFOLD_GROUP_TITLES: Record<ScaffoldGroup, { step: string; section: string; label: string }> = {
    basics: { step: 'General', section: 'Details', label: 'Values' },
    references: { step: 'Links', section: 'Related', label: 'Links to other records' },
    collections: { step: 'Collections', section: 'Collections', label: 'Collections' },
};

/** One property the builder can generate a field for. */
export interface ScaffoldCandidate {
    /** The property the form field or display field reads (`Name`, `TownId`, `Streets`). */
    property: string;
    label: string;
    group: ScaffoldGroup;
    /** What it becomes, in words ("Text", "Town picker", "Streets list"). */
    becomes: string;
    required: boolean;
    /** Reference / collection: the related type. */
    relatedType?: string;
    /** Reference: the foreign key (`TownId`) and the navigation (`Town`) when the type has them. */
    foreignKey?: string;
    navigation?: string;
    source: FieldMetadataDto;
}

/** A property left out, with why (shown under the list so nothing disappears silently). */
export interface ScaffoldSkip {
    property: string;
    reason: string;
}

export interface ScaffoldPlan {
    candidates: ScaffoldCandidate[];
    skipped: ScaffoldSkip[];
}

const SYSTEM_FIELD = /^(id|createdat|updatedat|deletedat|rowversion|concurrencystamp)$/i;

/** "DefaultDisplayName" → "Default display name"; "IconMaterialRefId" → "Icon material ref". */
export function humanizeProperty(name: string, stripId = false): string {
    const base = stripId && /.Id$/.test(name) ? name.slice(0, -2) : name;
    const words = base
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim()
        .split(/\s+/);
    if (words.length === 0 || !words[0]) return name;
    return [words[0], ...words.slice(1).map(w => (/^[A-Z0-9]+$/.test(w) && w.length > 1 ? w : w.toLowerCase()))].join(' ');
}

const TYPE_WORDS: Partial<Record<FieldType, string>> = {
    [FieldType.String]: 'Text',
    [FieldType.Integer]: 'Whole number',
    [FieldType.Decimal]: 'Number',
    [FieldType.Boolean]: 'Yes / no',
    [FieldType.DateTime]: 'Date and time',
    [FieldType.Enum]: 'Choice',
};

/** The picker a reference to `type` gets in a form (materials and enchantments have their own). */
export function referenceFieldType(relatedType: string): FieldType {
    if (relatedType === 'MinecraftMaterialRef') return FieldType.HybridMinecraftMaterialRefPicker;
    if (relatedType === 'MinecraftEnchantmentRef') return FieldType.HybridMinecraftEnchantmentRefPicker;
    return FieldType.Object;
}

/**
 * Sorts a type's properties into values, links (one record) and collections, pairing a foreign key with its navigation
 * (`TownId` + `Town` is one link). Ids, timestamps and GUIDs are set by the system and left out.
 */
export function planScaffold(meta: EntityMetadataDto): ScaffoldPlan {
    const fields = meta.fields ?? [];
    const byName = new Map(fields.map(f => [f.fieldName.toLowerCase(), f]));
    const candidates: ScaffoldCandidate[] = [];
    const skipped: ScaffoldSkip[] = [];
    const paired = new Set<string>();

    // Links first, so a foreign key and its navigation become one candidate.
    for (const f of fields) {
        if (SYSTEM_FIELD.test(f.fieldName) || /guid$/i.test(f.fieldName)) continue;
        const type = mapFieldType(f.fieldType);
        if (type === FieldType.List) continue;
        const isKey = /.Id$/.test(f.fieldName);
        const navName = isKey ? f.fieldName.slice(0, -2) : undefined;
        const nav = navName ? byName.get(navName.toLowerCase()) : undefined;
        const relatedType = f.relatedEntityType || (isKey ? nav?.relatedEntityType : undefined) || undefined;
        if (!relatedType || !isKey || paired.has(f.fieldName)) continue;
        if (!f.isRelatedEntity && !nav?.isRelatedEntity) continue;
        paired.add(f.fieldName);
        if (nav) paired.add(nav.fieldName);
        candidates.push({
            property: f.fieldName,
            label: humanizeProperty(f.fieldName, true),
            group: 'references',
            becomes: `${humanizeProperty(relatedType)} picker`,
            required: !f.isNullable,
            relatedType,
            foreignKey: f.fieldName,
            navigation: nav?.fieldName,
            source: f,
        });
    }

    for (const f of fields) {
        if (paired.has(f.fieldName)) continue;
        if (SYSTEM_FIELD.test(f.fieldName) || /guid$/i.test(f.fieldName)) {
            skipped.push({ property: f.fieldName, reason: 'Set by the system.' });
            continue;
        }
        const type = mapFieldType(f.fieldType);
        if (type === FieldType.List) {
            if (f.isRelatedEntity && f.relatedEntityType) {
                candidates.push({
                    property: f.fieldName,
                    label: humanizeProperty(f.fieldName),
                    group: 'collections',
                    becomes: `${humanizeProperty(f.relatedEntityType)} list`,
                    required: false,
                    relatedType: f.relatedEntityType,
                    navigation: f.fieldName,
                    source: f,
                });
            } else {
                skipped.push({ property: f.fieldName, reason: 'A collection without a known record type.' });
            }
            continue;
        }
        if (f.isRelatedEntity && f.relatedEntityType) {
            // A navigation without a foreign key: shown on a page, but a form has no column to save it in.
            candidates.push({
                property: f.fieldName,
                label: humanizeProperty(f.fieldName),
                group: 'references',
                becomes: `${humanizeProperty(f.relatedEntityType)} (read only)`,
                required: false,
                relatedType: f.relatedEntityType,
                navigation: f.fieldName,
                source: f,
            });
            continue;
        }
        if (type === FieldType.Object) {
            skipped.push({ property: f.fieldName, reason: 'Not a value a form or page can show on its own.' });
            continue;
        }
        candidates.push({
            property: f.fieldName,
            label: humanizeProperty(f.fieldName),
            group: 'basics',
            becomes: TYPE_WORDS[type] ?? type,
            required: !f.isNullable && type !== FieldType.Boolean,
            source: f,
        });
    }

    const order: ScaffoldGroup[] = ['basics', 'references', 'collections'];
    candidates.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
    return { candidates, skipped };
}

/** What a form can generate: a link needs a foreign key; collections need a many-to-many step made by hand. */
export function formCandidateProblem(candidate: ScaffoldCandidate): string | null {
    if (candidate.group === 'collections') {
        return 'Collections need a many-to-many step or a list field set up by hand (a join form, the element type).';
    }
    if (candidate.group === 'references' && !candidate.foreignKey) {
        return 'No foreign key to save the link in; pick it on the record it belongs to.';
    }
    return null;
}

/** What a display can generate: a link is shown through its navigation. */
export function displayCandidateProblem(candidate: ScaffoldCandidate): string | null {
    if (candidate.group !== 'basics' && !candidate.navigation) {
        return 'No navigation property to show the related record through.';
    }
    return null;
}

/** A new GUID (also where `crypto.randomUUID` is missing: old browsers, the test runner). */
export const newGuid = (): string =>
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

let tempCounter = 0;
const tempId = (): string => `temp-${Date.now()}-${++tempCounter}`;

function formField(candidate: ScaffoldCandidate, order: number): FormFieldDto {
    const type = candidate.group === 'references' ? referenceFieldType(candidate.relatedType!) : mapFieldType(candidate.source.fieldType);
    const meta = candidate.source;
    const hasDefault = meta.hasDefaultValue && meta.defaultValue != null && type !== FieldType.List;
    const settings = type === FieldType.Enum && meta.enumValues?.length ? JSON.stringify({ enumValues: meta.enumValues }) : undefined;
    return {
        id: tempId(),
        fieldGuid: newGuid(),
        fieldName: candidate.property,
        label: candidate.label,
        fieldType: type,
        objectType: type === FieldType.Object ? candidate.relatedType : undefined,
        isRequired: candidate.required,
        isReadOnly: false,
        defaultValue: hasDefault ? meta.defaultValue ?? undefined : undefined,
        settingsJson: settings,
        order,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        validations: [],
    };
}

function formStep(name: string, order: number, fields: FormFieldDto[]): FormStepDto {
    return {
        id: tempId(),
        stepGuid: newGuid(),
        stepName: name,
        description: '',
        order,
        fieldOrderJson: JSON.stringify(fields.map(f => f.fieldGuid)),
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: false,
        childFormSteps: [],
        fields,
        conditions: [],
    };
}

/** One step per group (General, Links) with the chosen properties; `firstOrder` continues an existing form. */
export function scaffoldFormSteps(candidates: ScaffoldCandidate[], firstOrder = 0): FormStepDto[] {
    const steps: FormStepDto[] = [];
    (['basics', 'references'] as ScaffoldGroup[]).forEach(group => {
        const chosen = candidates.filter(c => c.group === group && !formCandidateProblem(c));
        if (chosen.length === 0) return;
        steps.push(formStep(SCAFFOLD_GROUP_TITLES[group].step, firstOrder + steps.length, chosen.map((c, i) => formField(c, i))));
    });
    return steps;
}

/** The property a related record is shown by: its name when it has one. */
export function labelPropertyOf(meta: EntityMetadataDto | undefined): string {
    const names = new Set((meta?.fields ?? []).map(f => f.fieldName));
    for (const candidate of ['Name', 'DisplayName', 'Title', 'Username', 'Label', 'Code']) {
        if (names.has(candidate)) return candidate;
    }
    return 'Id';
}

function displayField(fieldName: string, label: string, fieldType?: string, related?: { property: string; type: string }): DisplayFieldDto {
    return {
        id: tempId(),
        fieldGuid: newGuid(),
        fieldName,
        label,
        fieldType,
        relatedEntityPropertyName: related?.property,
        relatedEntityTypeName: related?.type,
        isReusable: false,
        isLinkedToSource: false,
        isEditableInDisplay: false,
    };
}

function displaySection(name: string, fields: DisplayFieldDto[], collection?: { property: string; type: string }): DisplaySectionDto {
    return {
        id: tempId(),
        sectionGuid: newGuid(),
        sectionName: name,
        description: '',
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isCollection: !!collection,
        relatedEntityPropertyName: collection?.property,
        relatedEntityTypeName: collection?.type,
        actionButtonsConfigJson: collection ? JSON.stringify({ showViewButton: true }) : undefined,
        fieldOrderJson: JSON.stringify(fields.map(f => f.fieldGuid)),
        fields,
        subSections: [],
    };
}

/**
 * Details (values), Related (one field per link, showing the related record's name) and one collection section per
 * chosen collection. `metadataFor` gives the related types' metadata (for the name to show).
 */
export function scaffoldDisplaySections(
    candidates: ScaffoldCandidate[],
    metadataFor: (type: string) => EntityMetadataDto | undefined
): DisplaySectionDto[] {
    const sections: DisplaySectionDto[] = [];
    const usable = candidates.filter(c => !displayCandidateProblem(c));
    const basics = usable.filter(c => c.group === 'basics');
    if (basics.length > 0) {
        sections.push(displaySection(SCAFFOLD_GROUP_TITLES.basics.section,
            basics.map(c => displayField(c.property, c.label, mapFieldType(c.source.fieldType)))));
    }
    const references = usable.filter(c => c.group === 'references');
    if (references.length > 0) {
        sections.push(displaySection(SCAFFOLD_GROUP_TITLES.references.section, references.map(c =>
            displayField(labelPropertyOf(metadataFor(c.relatedType!)), c.label, FieldType.String,
                { property: c.navigation!, type: c.relatedType! }))));
    }
    usable.filter(c => c.group === 'collections').forEach(c => {
        const label = labelPropertyOf(metadataFor(c.relatedType!));
        sections.push(displaySection(c.label, [displayField(label, humanizeProperty(label), FieldType.String)],
            { property: c.navigation!, type: c.relatedType! }));
    });
    return sections;
}

/** Properties a form already has a field for (any step, child steps too). */
export function formFieldNames(steps: FormStepDto[]): Set<string> {
    const names = new Set<string>();
    const visit = (list: FormStepDto[]) => list.forEach(step => {
        step.fields.forEach(f => f.fieldName && names.add(f.fieldName.toLowerCase()));
        visit(step.childFormSteps ?? []);
    });
    visit(steps);
    return names;
}

/** Properties a display already shows (a link counts by its navigation). */
export function displayPropertyNames(sections: DisplaySectionDto[]): Set<string> {
    const names = new Set<string>();
    const visit = (list: DisplaySectionDto[]) => list.forEach(section => {
        if (section.relatedEntityPropertyName) names.add(section.relatedEntityPropertyName.toLowerCase());
        section.fields.forEach(f => {
            const name = f.relatedEntityPropertyName || f.fieldName;
            if (name) names.add(name.toLowerCase());
        });
        visit(section.subSections ?? []);
    });
    visit(sections);
    return names;
}

/** Whether the configuration already covers a candidate (by its property, foreign key or navigation). */
export function isCovered(candidate: ScaffoldCandidate, names: Set<string>): boolean {
    return [candidate.property, candidate.foreignKey, candidate.navigation]
        .some(name => !!name && names.has(name.toLowerCase()));
}
