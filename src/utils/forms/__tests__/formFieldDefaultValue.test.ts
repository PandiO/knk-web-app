import { FieldType } from '../../enums';
import { formFieldDefaultValue, seededFormFieldValue } from '../formFieldDefaultValue';

describe('formFieldDefaultValue', () => {
    it('uses false for an untouched Boolean field without an authored default', () => {
        expect(formFieldDefaultValue({
            fieldType: FieldType.Boolean,
            defaultValue: null
        })).toBe(false);
    });

    it('normalizes authored Boolean defaults to booleans', () => {
        expect(formFieldDefaultValue({
            fieldType: FieldType.Boolean,
            defaultValue: 'true'
        })).toBe(true);
        expect(formFieldDefaultValue({
            fieldType: FieldType.Boolean,
            defaultValue: 'false'
        })).toBe(false);
    });

    it('preserves the existing null fallback for other field types', () => {
        expect(formFieldDefaultValue({
            fieldType: FieldType.String,
            defaultValue: null
        })).toBeNull();
    });
});

describe('seededFormFieldValue', () => {
    const bool = { fieldType: FieldType.Boolean, defaultValue: undefined };

    it('turns a missing or null Boolean into its default (KNG-53)', () => {
        expect(seededFormFieldValue(bool, false, undefined)).toBe(false);
        expect(seededFormFieldValue(bool, true, null)).toBe(false);
        expect(seededFormFieldValue(bool, true, undefined)).toBe(false);
        expect(seededFormFieldValue({ ...bool, defaultValue: 'true' }, true, null)).toBe(true);
    });

    it('keeps an explicit Boolean, including false over a true default', () => {
        expect(seededFormFieldValue({ ...bool, defaultValue: 'true' }, true, false)).toBe(false);
        expect(seededFormFieldValue(bool, true, true)).toBe(true);
        expect(seededFormFieldValue(bool, true, 'false')).toBe(false);
        expect(seededFormFieldValue(bool, true, 'true')).toBe(true);
    });

    it('keeps present values of other field types, null included', () => {
        const text = { fieldType: FieldType.String, defaultValue: 'x' };
        expect(seededFormFieldValue(text, true, null)).toBeNull();
        expect(seededFormFieldValue(text, true, 'abc')).toBe('abc');
        expect(seededFormFieldValue(text, false, undefined)).toBe('x');
    });
});
