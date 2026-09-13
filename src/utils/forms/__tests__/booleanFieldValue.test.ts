import { toBooleanFieldValue } from '../booleanFieldValue';

describe('toBooleanFieldValue', () => {
    it('treats the string "false" (an untouched field\'s raw default) as false', () => {
        expect(toBooleanFieldValue('false')).toBe(false);
    });

    it('treats the string "true" as true', () => {
        expect(toBooleanFieldValue('true')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(toBooleanFieldValue('False')).toBe(false);
        expect(toBooleanFieldValue('TRUE')).toBe(true);
    });

    it('falls back to normal truthiness for actual booleans', () => {
        expect(toBooleanFieldValue(true)).toBe(true);
        expect(toBooleanFieldValue(false)).toBe(false);
    });

    it('falls back to normal truthiness for non-boolean-string values', () => {
        expect(toBooleanFieldValue(null)).toBe(false);
        expect(toBooleanFieldValue(undefined)).toBe(false);
        expect(toBooleanFieldValue('')).toBe(false);
    });
});
