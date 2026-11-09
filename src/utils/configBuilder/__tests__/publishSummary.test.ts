import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { FieldType } from '../../enums';
import { summarizeDisplayPublish, summarizeFormPublish } from '../publishSummary';

const field = (id: string, label: string, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id, fieldGuid: `g-${id}`, fieldName: label.replace(/\s/g, ''), label, fieldType: FieldType.String, isRequired: false,
    isReadOnly: false, order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...extra,
});

const step = (id: string, name: string, fields: FormFieldDto[]): FormStepDto => ({
    id, stepGuid: `s-${id}`, stepName: name, order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
    isManyToManyRelationship: false, childFormSteps: [], fields, conditions: [],
});

const form = (steps: FormStepDto[], extra: Partial<FormConfigurationDto> = {}): FormConfigurationDto => ({
    id: '7', entityTypeName: 'Town', configurationName: 'Town form', isDefault: true, steps, ...extra,
});

const published = form([step('1', 'General', [field('10', 'Name'), field('11', 'Description')]), step('2', 'Map', [field('12', 'World')])]);

describe('summarizeFormPublish', () => {
    it('on a first publish lists everything as added', () => {
        const summary = summarizeFormPublish(null, published);
        expect(summary.lines).toEqual([
            '2 steps added: "General", "Map".',
            '3 fields added: "Name", "Description", "World".',
        ]);
        expect(summary.defaultChange).toBe(true);
    });

    it('names added, removed and changed steps and fields, a rename and the default', () => {
        const working = form([
            step('1', 'Basics', [field('10', 'Name', { isRequired: true }), field('temp-1', 'Mayor')]),
            step('temp-2', 'Extra', []),
        ], { configurationName: 'Town form v2', isDefault: false });

        const summary = summarizeFormPublish(published, working);

        expect(summary.lines).toEqual([
            '1 step added: "Extra".',
            '1 step removed: "Map".',
            '1 step changed: "Basics".',
            '1 field added: "Mayor".',
            '2 fields removed: "Description", "World".',
            '1 field changed: "Name".',
            'Renamed from "Town form" to "Town form v2".',
        ]);
        expect(summary.defaultChange).toBe(false);
    });

    it('says nothing when the copy equals the published version, and notices a new order', () => {
        expect(summarizeFormPublish(published, published).lines).toEqual([]);
        const reordered = form([published.steps[1], published.steps[0]]);
        expect(summarizeFormPublish(published, reordered).lines).toEqual(['The steps are in a new order.']);
    });

    it('cuts long lists', () => {
        const many = form([step('1', 'General', ['A', 'B', 'C', 'D', 'E', 'F'].map((l, i) => field(`n${i}`, l)))]);
        expect(summarizeFormPublish(form([step('1', 'General', [])]), many).lines).toContain(
            '6 fields added: "A", "B", "C", "D" and 2 more.'
        );
    });
});

describe('summarizeDisplayPublish', () => {
    const display = (sections: DisplayConfigurationDto['sections'], extra: Partial<DisplayConfigurationDto> = {}): DisplayConfigurationDto => ({
        id: '3', name: 'Town page', entityTypeName: 'Town', isDefault: false, isDraft: false, sections, ...extra,
    });
    const section = (id: string, name: string, labels: string[], subSections: DisplayConfigurationDto['sections'] = []) => ({
        id, sectionGuid: `sg-${id}`, sectionName: name, isReusable: false, isLinkedToSource: false, isCollection: false,
        fields: labels.map((label, i) => ({ id: `${id}-${i}`, fieldGuid: `fg-${id}-${i}`, label, fieldName: label, isReusable: false, isLinkedToSource: false })),
        subSections,
    });

    it('counts sections (sub-sections too) and fields, and the default', () => {
        const before = display([section('1', 'General', ['Name'])]);
        const after = display([section('1', 'General', ['Name', 'Mayor'], [section('temp-9', 'Streets item', ['Street'])])], { isDefault: true });
        const summary = summarizeDisplayPublish(before, after);
        expect(summary.lines).toEqual([
            '1 section added: "Streets item".',
            '2 fields added: "Mayor", "Street".',
        ]);
        expect(summary.defaultChange).toBe(true);
    });
});
