import { scannedItemDescription } from '../scannedItemDescription';

// PandiO/knk-workspace#40: the scan's cleaned descriptionLore wins over the raw lore.
describe('scannedItemDescription', () => {
    const rawLore = [
        '§7Strength II',
        '§7Chaos I',
        '',
        '§8Forged in the last fire of a fallen',
        '§8dojo.',
        '§8Its edge never cools.',
        '',
        '§l§bGrade: ★★★★★',
        '§7Origin: Cinix (Town)'
    ];

    it('uses descriptionLore when the plugin sends it', () => {
        expect(scannedItemDescription({
            lore: rawLore,
            descriptionLore: ['§8Forged in the last fire of a fallen dojo.', '§8Its edge never cools.']
        })).toBe('§8Forged in the last fire of a fallen dojo.\n§8Its edge never cools.');
    });

    it('gives an empty description when descriptionLore is empty, even with generated lore', () => {
        expect(scannedItemDescription({ lore: ['§7Strength II', '', '§l§bGrade: ★★'], descriptionLore: [] })).toBe('');
    });

    it('falls back to the raw lore from a plugin without descriptionLore', () => {
        expect(scannedItemDescription({ lore: ['§5Old plugin', 'second line'] })).toBe('§5Old plugin\nsecond line');
    });

    it('ignores anything that is not a lore line', () => {
        expect(scannedItemDescription({ descriptionLore: ['one', 7, null, 'two'] })).toBe('one\ntwo');
        expect(scannedItemDescription({})).toBe('');
        expect(scannedItemDescription(null)).toBe('');
        expect(scannedItemDescription('lore')).toBe('');
    });
});
