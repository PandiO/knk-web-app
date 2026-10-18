import { resolveObjectFieldValueForEdit } from '../objectFieldEditValue';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';
import { findValueByFieldName } from '../../fieldNameMapper';

const objectField = (fieldName: string, extra: Partial<FormFieldDto> = {}): FormFieldDto =>
    ({ fieldName, fieldType: FieldType.Object, objectType: 'ItemBlueprint', ...extra } as FormFieldDto);

// Mirrors FormWizard.loadExistingEntityData: look up the field's own name, then resolve.
const load = (entityData: Record<string, unknown>, field: FormFieldDto) =>
    resolveObjectFieldValueForEdit(entityData, field, findValueByFieldName(entityData, field.fieldName));

describe('resolveObjectFieldValueForEdit', () => {
    it('uses the navigation object for a navigation-authored field when the DTO carries it', () => {
        const helmet = { id: 20, name: 'iron_helmet', defaultDisplayName: 'Iron Helmet' };
        expect(load({ helmetId: 20, helmet }, objectField('Helmet'))).toBe(helmet);
    });

    it('falls back to { id } from the FK when the DTO has no navigation object', () => {
        // The Kit edit-mode bug: KitDto exposed only helmetId, so the "Helmet" picker loaded
        // empty and an untouched submit nulled the FK.
        expect(load({ helmetId: 20 }, objectField('Helmet'))).toEqual({ id: 20 });
        expect(load({ helmetId: 20, helmet: null }, objectField('Helmet'))).toEqual({ id: 20 });
    });

    it('stays empty when neither the navigation object nor the FK is set', () => {
        expect(load({ helmetId: null, helmet: null }, objectField('Helmet'))).toBeNull();
        expect(load({}, objectField('Helmet'))).toBeNull();
    });

    it('swaps a bare FK for the navigation object on an FK-authored field', () => {
        const anchor = { id: 5, name: 'Spawn', x: 1, y: 2, z: 3 };
        expect(load({ anchorPointId: 5, anchorPoint: anchor }, objectField('AnchorPointId'))).toBe(anchor);
    });

    it('keeps the bare FK on an FK-authored field when there is no navigation object', () => {
        expect(load({ anchorPointId: 5 }, objectField('AnchorPointId'))).toBe(5);
    });

    it('builds { id, name } on an FK-authored field from an FK + display-name DTO', () => {
        // The siege read DTOs expose townId + townName but no Town object.
        expect(load({ townId: 7, townName: 'Cinix' }, objectField('TownId'))).toEqual({ id: 7, name: 'Cinix' });
        expect(load({ townId: 7, townName: '' }, objectField('TownId'))).toBe(7);
    });

    it('leaves non-Object fields alone and applies the default only when the value is missing', () => {
        const text = { fieldName: 'Name', fieldType: FieldType.String, defaultValue: 'x' } as FormFieldDto;
        expect(load({ name: 'Starter' }, text)).toBe('Starter');
        expect(load({}, text)).toBe('x');
    });

    describe('List relationship fields (KNG-135)', () => {
        const listField = (fieldName: string, extra: Partial<FormFieldDto> = {}): FormFieldDto =>
            ({ fieldName, fieldType: FieldType.List, objectType: 'District', ...extra } as FormFieldDto);
        const districts = [{ id: 2, name: 'Old Quarter' }, { id: 3, name: 'Harbour' }];

        it('loads an XIds-authored field from the DTO navigation list (the Street read before the API fix)', () => {
            expect(load({ districtIds: [], districts }, listField('DistrictIds'))).toBe(districts);
            expect(load({ districts }, listField('DistrictIds'))).toBe(districts);
        });

        it('prefers the navigation objects over bare ids on an XIds-authored field (they carry names)', () => {
            expect(load({ districtIds: [2, 3], districts }, listField('DistrictIds'))).toBe(districts);
        });

        it('turns bare ids into { id } objects on an XIds-authored field without a navigation list', () => {
            expect(load({ districtIds: [2, 3] }, listField('DistrictIds'))).toEqual([{ id: 2 }, { id: 3 }]);
            expect(load({ districtIds: [2, 3], districts: [] }, listField('DistrictIds'))).toEqual([{ id: 2 }, { id: 3 }]);
        });

        it('falls back to { id } objects from XIds on an Xs-authored field with no navigation list', () => {
            expect(load({ districtIds: [2, 3] }, listField('Districts'))).toEqual([{ id: 2 }, { id: 3 }]);
            expect(load({ districtIds: [2, 3], districts: [] }, listField('Districts'))).toEqual([{ id: 2 }, { id: 3 }]);
            expect(load({ districtIds: [2], districts: null }, listField('Districts'))).toEqual([{ id: 2 }]);
        });

        it('keeps the navigation list on an Xs-authored field when the DTO has it', () => {
            expect(load({ districtIds: [2, 3], districts }, listField('Districts'))).toBe(districts);
        });

        it('pairs -y/-ies names (CategoryIds <-> Categories)', () => {
            const categories = [{ id: 9, name: 'Tools' }];
            expect(load({ categories }, listField('CategoryIds', { objectType: 'Category' }))).toBe(categories);
            expect(load({ categoryIds: [9] }, listField('Categories', { objectType: 'Category' }))).toEqual([{ id: 9 }]);
        });

        it('keeps held objects as they are (seeding a child from the values a parent holds)', () => {
            const held = [{ id: 2, name: 'Old Quarter' }, { name: 'New, not saved' }];
            expect(load({ DistrictIds: held }, listField('DistrictIds'))).toBe(held);
        });

        it('stays empty when neither side has values, and leaves lists without an objectType alone', () => {
            expect(load({ districtIds: [], districts: [] }, listField('DistrictIds'))).toEqual([]);
            expect(load({}, listField('Districts'))).toBeNull();
            const plain = { fieldName: 'TagIds', fieldType: FieldType.List, elementType: FieldType.Integer } as FormFieldDto;
            expect(load({ tagIds: [1, 2], tags: [{ id: 1 }] }, plain)).toEqual([1, 2]);
        });
    });
});
