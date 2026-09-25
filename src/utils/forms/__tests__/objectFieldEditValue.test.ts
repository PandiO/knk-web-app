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
});
