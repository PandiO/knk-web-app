import { EntityMetadataDto, FieldMetadataDto } from '../../../types/dtos/metadata/MetadataModels';
import { FieldType } from '../../enums';
import {
    displayCandidateProblem, displayPropertyNames, formCandidateProblem, formFieldNames, humanizeProperty, isCovered,
    labelPropertyOf, planScaffold, scaffoldDisplaySections, scaffoldFormSteps,
} from '../scaffold';

const f = (fieldName: string, fieldType: string, extra: Partial<FieldMetadataDto> = {}): FieldMetadataDto => ({
    fieldName, fieldType, isNullable: false, isRelatedEntity: false, hasDefaultValue: false, ...extra,
});

/** Shaped like knk-web-api's Category metadata (FK + navigation pairs, a collection, system fields). */
const category: EntityMetadataDto = {
    entityName: 'Category',
    displayName: 'Category',
    fields: [
        f('Id', 'Integer'),
        f('Name', 'String'),
        f('IconMaterialRefId', 'Integer', { isNullable: true }),
        f('IconMaterialRef', 'MinecraftMaterialRef', { isRelatedEntity: true, relatedEntityType: 'MinecraftMaterialRef', isNullable: true }),
        f('ParentCategoryId', 'Integer', { isRelatedEntity: true, relatedEntityType: 'Category', isNullable: true }),
        f('ParentCategory', 'Category', { isRelatedEntity: true, relatedEntityType: 'Category', isNullable: true }),
        f('ChildCategories', 'List', { isRelatedEntity: true, relatedEntityType: 'Category' }),
        f('Kind', 'Enum', { isEnum: true, enumValues: ['Weapon', 'Armour'] }),
        f('IsHidden', 'Boolean'),
        f('CreatedAt', 'DateTime'),
        f('ConfigurationGuid', 'Guid'),
        f('Settings', 'CategorySettings'),
    ],
};

describe('planScaffold', () => {
    const plan = planScaffold(category);
    const byProperty = Object.fromEntries(plan.candidates.map(c => [c.property, c]));

    it('pairs a foreign key with its navigation as one link', () => {
        expect(byProperty.ParentCategoryId).toMatchObject({
            group: 'references', label: 'Parent category', relatedType: 'Category', foreignKey: 'ParentCategoryId', navigation: 'ParentCategory', required: false,
        });
        expect(byProperty.IconMaterialRefId).toMatchObject({ relatedType: 'MinecraftMaterialRef', navigation: 'IconMaterialRef' });
        expect(byProperty.ParentCategory).toBeUndefined();
        expect(byProperty.IconMaterialRef).toBeUndefined();
    });

    it('sorts values first, then links, then collections; booleans are never required', () => {
        expect(plan.candidates.map(c => c.group)).toEqual(['basics', 'basics', 'basics', 'references', 'references', 'collections']);
        expect(byProperty.Name).toMatchObject({ becomes: 'Text', required: true });
        expect(byProperty.IsHidden.required).toBe(false);
        expect(byProperty.ChildCategories).toMatchObject({ group: 'collections', relatedType: 'Category' });
    });

    it('leaves out system fields and plain objects, with the reason', () => {
        expect(plan.skipped).toEqual(expect.arrayContaining([
            { property: 'Id', reason: 'Set by the system.' },
            { property: 'CreatedAt', reason: 'Set by the system.' },
            { property: 'ConfigurationGuid', reason: 'Set by the system.' },
            { property: 'Settings', reason: 'Not a value a form or page can show on its own.' },
        ]));
    });
});

describe('form steps', () => {
    const plan = planScaffold(category);

    it('makes one step per group, with sensible field types and its own GUIDs', () => {
        const steps = scaffoldFormSteps(plan.candidates, 2);
        expect(steps.map(s => [s.stepName, s.order])).toEqual([['General', 2], ['Links', 3]]);
        const general = steps[0].fields;
        expect(general.map(x => [x.fieldName, x.fieldType])).toEqual([
            ['Name', FieldType.String], ['Kind', FieldType.Enum], ['IsHidden', FieldType.Boolean],
        ]);
        expect(JSON.parse(general[1].settingsJson!)).toEqual({ enumValues: ['Weapon', 'Armour'] });
        const links = steps[1].fields;
        expect(links.map(x => [x.fieldName, x.fieldType, x.objectType])).toEqual([
            ['IconMaterialRefId', FieldType.HybridMinecraftMaterialRefPicker, undefined],
            ['ParentCategoryId', FieldType.Object, 'Category'],
        ]);
        expect(steps[0].id).toMatch(/^temp-/);
        expect(JSON.parse(steps[0].fieldOrderJson!)).toEqual(general.map(x => x.fieldGuid));
        expect(new Set(steps.flatMap(s => [s.stepGuid, ...s.fields.map(x => x.fieldGuid)])).size).toBe(7);
    });

    it('leaves collections to a many-to-many step made by hand', () => {
        const children = plan.candidates.find(c => c.property === 'ChildCategories')!;
        expect(formCandidateProblem(children)).toMatch(/many-to-many/);
        expect(scaffoldFormSteps([children])).toEqual([]);
    });
});

describe('display sections', () => {
    const plan = planScaffold(category);

    it('shows values, links by the related record\'s name, and a section per collection', () => {
        const sections = scaffoldDisplaySections(plan.candidates, type => (type === 'Category' ? category : undefined));
        expect(sections.map(s => [s.sectionName, s.isCollection, s.relatedEntityPropertyName ?? null])).toEqual([
            ['Details', false, null], ['Related', false, null], ['Child categories', true, 'ChildCategories'],
        ]);
        expect(sections[1].fields.map(x => [x.label, x.fieldName, x.relatedEntityPropertyName])).toEqual([
            ['Icon material ref', 'Id', 'IconMaterialRef'], ['Parent category', 'Name', 'ParentCategory'],
        ]);
    });

    it('needs a navigation for a link', () => {
        expect(displayCandidateProblem({ ...plan.candidates[3], navigation: undefined })).toMatch(/navigation/);
    });
});

describe('helpers', () => {
    it('humanizes property names', () => {
        expect(humanizeProperty('DefaultDisplayName')).toBe('Default display name');
        expect(humanizeProperty('TownId', true)).toBe('Town');
        expect(humanizeProperty('XPLevel')).toBe('XP level');
    });

    it('finds the label property of a related type', () => {
        expect(labelPropertyOf(category)).toBe('Name');
        expect(labelPropertyOf({ entityName: 'X', displayName: 'X', fields: [f('Username', 'String')] })).toBe('Username');
        expect(labelPropertyOf(undefined)).toBe('Id');
    });

    it('knows which properties a configuration already covers', () => {
        const plan = planScaffold(category);
        const steps = scaffoldFormSteps(plan.candidates.filter(c => c.property === 'ParentCategoryId'));
        const formNames = formFieldNames(steps);
        expect(isCovered(plan.candidates.find(c => c.property === 'ParentCategoryId')!, formNames)).toBe(true);
        expect(isCovered(plan.candidates.find(c => c.property === 'Name')!, formNames)).toBe(false);

        const sections = scaffoldDisplaySections(plan.candidates.filter(c => c.property === 'ParentCategoryId'), () => category);
        expect(isCovered(plan.candidates.find(c => c.property === 'ParentCategoryId')!, displayPropertyNames(sections))).toBe(true);
    });
});
