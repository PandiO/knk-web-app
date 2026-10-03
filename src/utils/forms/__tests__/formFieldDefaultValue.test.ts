import { FieldType } from '../../enums';
import { formFieldDefaultValue } from '../formFieldDefaultValue';

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
