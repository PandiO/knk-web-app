import { normalizeBlockStateString, normalizeNamespaceKey } from '../minecraftKeys';

describe('minecraftKeys (KNG-200)', () => {
    it('normalizes a namespaced key: trimmed, lower case, minecraft: added', () => {
        expect(normalizeNamespaceKey('minecraft:stone')).toBe('minecraft:stone');
        expect(normalizeNamespaceKey('  Minecraft:STONE ')).toBe('minecraft:stone');
        expect(normalizeNamespaceKey('oak_planks')).toBe('minecraft:oak_planks');
        expect(normalizeNamespaceKey('mymod:Ruby')).toBe('mymod:ruby');
    });

    it('gives an empty string for a blank or missing key', () => {
        expect(normalizeNamespaceKey(undefined)).toBe('');
        expect(normalizeNamespaceKey(null)).toBe('');
        expect(normalizeNamespaceKey('   ')).toBe('');
    });

    it('normalizes a block state string for comparison', () => {
        expect(normalizeBlockStateString(' minecraft:OAK_STAIRS[facing=north, half=bottom] ')).toBe('minecraft:oak_stairs[facing=north,half=bottom]');
        expect(normalizeBlockStateString(null)).toBe('');
    });
});
