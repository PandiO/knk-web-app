import { isMultilineStringField, parseMultilineSetting, resolveMultilineSetting } from '../stringFieldMultiline';

describe('isMultilineStringField (#109)', () => {
    it('is one line by default', () => {
        expect(isMultilineStringField(undefined, 'Name', 'Cinix')).toBe(false);
        expect(isMultilineStringField('{"minecraft-text-color":{"enabled":true}}', 'ChatPrefix', '')).toBe(false);
        expect(isMultilineStringField('not json', 'Name', 'x')).toBe(false);
    });

    it('is several lines for descriptions and lore unless the setting says otherwise', () => {
        expect(isMultilineStringField(undefined, 'Description')).toBe(true);
        expect(isMultilineStringField(undefined, 'DefaultDisplayDescription')).toBe(true);
        expect(isMultilineStringField(undefined, 'lore')).toBe(true);
        expect(isMultilineStringField('{"multiline":false}', 'Description')).toBe(false);
    });

    it('follows the setting', () => {
        expect(isMultilineStringField('{"multiline":true}', 'Name', '')).toBe(true);
        expect(parseMultilineSetting('{"multiline":"yes"}')).toBeUndefined();
        expect(resolveMultilineSetting('{"multiline":"yes"}', 'Name')).toBe(false);
    });

    it('keeps a value with a line break on several lines', () => {
        expect(isMultilineStringField('{"multiline":false}', 'Name', 'first\nsecond')).toBe(true);
    });
});
