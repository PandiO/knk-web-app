import { countListItems, validateListFieldCount } from '../listFieldValidation';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';

const list = (overrides: Partial<FormFieldDto> = {}): FormFieldDto =>
    ({ fieldName: 'DistrictIds', label: 'Districts', fieldType: FieldType.List, objectType: 'District', isRequired: false, ...overrides } as FormFieldDto);
const saved = { parentIsSaved: true };
const unsaved = { parentIsSaved: false };

describe('validateListFieldCount (KNG-164)', () => {
    it('treats an empty or missing list as missing for a required field', () => {
        const required = list({ isRequired: true });
        const message = 'Districts is required: select at least 1 District';
        expect(validateListFieldCount(required, [], unsaved)).toBe(message);
        expect(validateListFieldCount(required, null, unsaved)).toBe(message);
        expect(validateListFieldCount(required, undefined, unsaved)).toBe(message);
        expect(validateListFieldCount(required, [null, ''], unsaved)).toBe(message);
        expect(validateListFieldCount(required, [{ id: 2 }], unsaved)).toBeNull();
    });

    it('allows an optional empty list, also with a minSelection', () => {
        expect(validateListFieldCount(list(), [], saved)).toBeNull();
        expect(validateListFieldCount(list({ minSelection: 2 }), [], saved)).toBeNull();
    });

    it('enforces minSelection once the list has items, and as the required minimum', () => {
        expect(validateListFieldCount(list({ minSelection: 2 }), [{ id: 2 }], saved))
            .toBe('Districts needs at least 2 Districts (1 selected)');
        expect(validateListFieldCount(list({ minSelection: 2, isRequired: true }), [], saved))
            .toBe('Districts is required: select at least 2 Districts');
        expect(validateListFieldCount(list({ minSelection: 2 }), [{ id: 2 }, { id: 3 }], saved)).toBeNull();
    });

    it('enforces maxSelection', () => {
        expect(validateListFieldCount(list({ maxSelection: 1 }), [{ id: 2 }, { id: 3 }], saved))
            .toBe('Districts allows at most 1 District (2 selected)');
        expect(validateListFieldCount(list({ maxSelection: 2 }), [{ id: 2 }, { id: 3 }], saved)).toBeNull();
    });

    it('ignores null, zero or negative limits (null = no limit, as stored for existing rows)', () => {
        const noLimits = list({ minSelection: null as unknown as number, maxSelection: 0 });
        expect(validateListFieldCount(noLimits, [{ id: 1 }, { id: 2 }, { id: 3 }], saved)).toBeNull();
        expect(validateListFieldCount(list({ minSelection: -1 }), [{ id: 1 }], saved)).toBeNull();
    });

    it('skips an owned child collection until its parent is saved', () => {
        const doors = list({
            label: 'Gate doors', fieldName: 'GateDoors', objectType: 'GateDoor', isRequired: true, minSelection: 1,
            settingsJson: JSON.stringify({ ownedChildCollection: true })
        });
        expect(validateListFieldCount(doors, [], unsaved)).toBeNull();
        expect(validateListFieldCount(doors, [], saved)).toBe('Gate doors is required: select at least 1 GateDoor');
    });

    it('words a list without an objectType as items, and leaves other field types alone', () => {
        const tags = { fieldName: 'Tags', label: 'Tags', fieldType: FieldType.List, isRequired: true, minSelection: 2 } as FormFieldDto;
        expect(validateListFieldCount(tags, ['a'], saved)).toBe('Tags needs at least 2 items (1 selected)');
        const text = { fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true } as FormFieldDto;
        expect(validateListFieldCount(text, '', saved)).toBeNull();
    });
});

describe('countListItems', () => {
    it('counts the non-empty entries of an array and a single value as one', () => {
        expect(countListItems([{ id: 1 }, null, '', 0])).toBe(2);
        expect(countListItems({ name: 'x' })).toBe(1);
        expect(countListItems(null)).toBe(0);
    });
});
