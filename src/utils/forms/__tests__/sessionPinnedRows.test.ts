import {
    buildPinnedSection,
    isSameSelection,
    matchesPickerFilters,
    matchesSearchTerm,
    tableRowKey
} from '../sessionPinnedRows';

describe('sessionPinnedRows (KNG-136)', () => {
    describe('matchesSearchTerm', () => {
        it('matches every row for an empty term', () => {
            expect(matchesSearchTerm({ id: 1, name: 'Old Quarter' }, '')).toBe(true);
            expect(matchesSearchTerm({ id: 1, name: 'Old Quarter' }, undefined)).toBe(true);
        });

        it('matches a case-insensitive substring of a label field', () => {
            expect(matchesSearchTerm({ id: 1, name: 'Old Quarter' }, 'quart')).toBe(true);
            expect(matchesSearchTerm({ id: 1, DisplayName: 'Harbour' }, 'HARB')).toBe(true);
            expect(matchesSearchTerm({ id: 1, name: 'Old Quarter' }, 'harbour')).toBe(false);
        });

        it('matches the exact id', () => {
            expect(matchesSearchTerm({ id: 501, name: 'Old Quarter' }, '501')).toBe(true);
            expect(matchesSearchTerm({ id: 5012, name: 'Old Quarter' }, '501')).toBe(false);
        });
    });

    describe('matchesPickerFilters', () => {
        it('compares an id filter with the FK property, case-insensitively', () => {
            expect(matchesPickerFilters({ id: 1, townId: 4 }, { TownId: '4' })).toBe(true);
            expect(matchesPickerFilters({ id: 1, townId: 5 }, { TownId: '4' })).toBe(false);
        });

        it('falls back to the navigation object for an xId filter', () => {
            expect(matchesPickerFilters({ id: 1, town: { id: 4, name: 'Cinix' } }, { townId: '4' })).toBe(true);
            expect(matchesPickerFilters({ id: 1, town: { id: 9 } }, { townId: '4' })).toBe(false);
        });

        it('ignores prefer... filters (they only order the results)', () => {
            expect(matchesPickerFilters({ id: 1 }, { preferTownId: '4' })).toBe(true);
        });

        it('applies excludeIds', () => {
            expect(matchesPickerFilters({ id: 3 }, { excludeIds: '1, 3' })).toBe(false);
            expect(matchesPickerFilters({ id: 2 }, { excludeIds: '1,3' })).toBe(true);
        });

        it('hides a row that cannot answer a filter or has no value for it', () => {
            expect(matchesPickerFilters({ id: 1, name: 'x' }, { siegeScenarioId: '7' })).toBe(false);
            expect(matchesPickerFilters({ id: 1, siegeScenarioId: null }, { siegeScenarioId: '7' })).toBe(false);
        });
    });

    describe('tableRowKey', () => {
        it('keys by id, namespaceKey for enchantment refs, else by position', () => {
            expect(tableRowKey({ id: 5 }, 'District', 0)).toBe('id:5');
            expect(tableRowKey({ id: 5, namespaceKey: 'minecraft:sharpness' }, 'MinecraftEnchantmentRef', 0)).toBe('ns:minecraft:sharpness');
            expect(tableRowKey({ namespaceKey: 'minecraft:stone', isPersisted: false }, 'MinecraftMaterialRef', 2)).toBe('ns:minecraft:stone');
            expect(tableRowKey({ name: 'no id' }, 'District', 3)).toBe('index:3');
        });
    });

    describe('isSameSelection', () => {
        it('matches by id, and id-less values only by identity', () => {
            const a = { name: 'unsaved A' };
            const b = { name: 'unsaved B' };
            expect(isSameSelection({ id: 1 }, { id: '1' }, 'District')).toBe(true);
            expect(isSameSelection({ id: 1 }, { id: 2 }, 'District')).toBe(false);
            expect(isSameSelection(a, b, 'District')).toBe(false);
            expect(isSameSelection(a, a, 'District')).toBe(true);
        });

        it('matches enchantment refs by namespaceKey', () => {
            expect(isSameSelection(
                { id: 1, namespaceKey: 'minecraft:sharpness' },
                { namespaceKey: 'minecraft:sharpness' },
                'MinecraftEnchantmentRef'
            )).toBe(true);
        });
    });

    // KNG-200: hybrid Minecraft rows. Ids start at 1, so 0 / "0" / null mean "unsaved".
    describe('Minecraft catalogue rows without an id (KNG-200)', () => {
        it('never keys a row by id 0, "0" or null', () => {
            expect(tableRowKey({ id: 0, namespaceKey: 'minecraft:torch', isPersisted: false }, 'MinecraftMaterialRef', 0)).toBe('ns:minecraft:torch');
            expect(tableRowKey({ id: '0', namespaceKey: 'minecraft:torch' }, 'MinecraftMaterialRef', 0)).toBe('ns:minecraft:torch');
            expect(tableRowKey({ id: null, namespaceKey: 'minecraft:torch' }, 'MinecraftMaterialRef', 0)).toBe('ns:minecraft:torch');
            expect(tableRowKey({ id: 0, name: 'unsaved' }, 'District', 4)).toBe('index:4');
            expect(tableRowKey({ id: 12, namespaceKey: 'minecraft:torch' }, 'MinecraftMaterialRef', 0)).toBe('id:12');
        });

        it('keys unsaved material rows by normalised namespaceKey, so distinct rows stay distinct', () => {
            const keys = [
                { id: 0, namespaceKey: 'minecraft:torch' },
                { id: 0, namespaceKey: 'minecraft:lantern' },
                { id: null, namespaceKey: ' Stone ' }
            ].map((row, index) => tableRowKey(row, 'MinecraftMaterialRef', index));
            expect(keys).toEqual(['ns:minecraft:torch', 'ns:minecraft:lantern', 'ns:minecraft:stone']);
        });

        it('keys unsaved block rows by normalised namespaceKey and block state', () => {
            const north = { id: 0, namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=north]' };
            const south = { id: 0, namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=south]' };
            const plain = { id: null, namespaceKey: 'OAK_STAIRS' };
            expect(tableRowKey(north, 'MinecraftBlockRef', 0)).toBe('bs:minecraft:oak_stairs|minecraft:oak_stairs[facing=north]');
            expect(tableRowKey(south, 'MinecraftBlockRef', 1)).toBe('bs:minecraft:oak_stairs|minecraft:oak_stairs[facing=south]');
            expect(tableRowKey(plain, 'MinecraftBlockRef', 2)).toBe('bs:minecraft:oak_stairs|');
        });

        it('keeps two unsaved material rows apart, whatever stands in for the missing id', () => {
            const torch = { id: 0, namespaceKey: 'minecraft:torch' };
            const lantern = { id: 0, namespaceKey: 'minecraft:lantern' };
            expect(isSameSelection(torch, lantern, 'MinecraftMaterialRef')).toBe(false);
            expect(isSameSelection({ id: '0', namespaceKey: 'minecraft:torch' }, { id: null, namespaceKey: 'minecraft:lantern' }, 'MinecraftMaterialRef')).toBe(false);
            expect(isSameSelection({ namespaceKey: 'minecraft:torch' }, { id: 0, namespaceKey: 'minecraft:lantern' }, 'MinecraftMaterialRef')).toBe(false);
        });

        it('matches an unsaved material row with the same key in another notation', () => {
            expect(isSameSelection({ id: 0, namespaceKey: 'minecraft:stone' }, { id: null, namespaceKey: ' STONE' }, 'MinecraftMaterialRef')).toBe(true);
            expect(isSameSelection({ id: 7, namespaceKey: 'minecraft:stone' }, { id: 0, namespaceKey: 'Minecraft:Stone' }, 'MinecraftMaterialRef')).toBe(true);
            // Two saved rows still compare by id, even with one key (notation duplicates before the audit).
            expect(isSameSelection({ id: 7, namespaceKey: 'minecraft:stone' }, { id: 8, namespaceKey: 'stone' }, 'MinecraftMaterialRef')).toBe(false);
        });

        it('compares unsaved block rows by key and block state', () => {
            const north = { id: 0, namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=north]' };
            const south = { id: 0, namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=south]' };
            expect(isSameSelection(north, south, 'MinecraftBlockRef')).toBe(false);
            expect(isSameSelection(north, { id: null, namespaceKey: 'oak_stairs', blockStateString: ' minecraft:OAK_STAIRS[facing=north] ' }, 'MinecraftBlockRef')).toBe(true);
        });

        it('does not treat id 0 as an id for other entity types either', () => {
            expect(isSameSelection({ id: 0, name: 'a' }, { id: 0, name: 'b' }, 'District')).toBe(false);
            expect(isSameSelection({ id: '0' }, { id: 0 }, 'District')).toBe(false);
        });

        it('keeps enchantment refs keyed and compared by their namespaceKey as given', () => {
            expect(tableRowKey({ id: 0, namespaceKey: 'minecraft:sharpness' }, 'MinecraftEnchantmentRef', 0)).toBe('ns:minecraft:sharpness');
            expect(isSameSelection({ id: 0, namespaceKey: 'minecraft:sharpness' }, { id: 0, namespaceKey: 'minecraft:sharpness' }, 'MinecraftEnchantmentRef')).toBe(true);
            expect(isSameSelection({ namespaceKey: 'minecraft:sharpness' }, { namespaceKey: 'SHARPNESS' }, 'MinecraftEnchantmentRef')).toBe(false);
        });

        it('does not pin or match an id-0 row by id', () => {
            expect(matchesSearchTerm({ id: 0, name: 'Torch' }, '0')).toBe(false);
            const section = buildPinnedSection([{ key: 'x', row: { id: 0, name: 'zero' } }], [{ id: 0, name: 'page' }], '', {});
            expect(section.pinned).toEqual([]);
            expect(section.pageItems).toEqual([{ id: 0, name: 'page' }]);
        });
    });

    describe('buildPinnedSection', () => {
        const pins = [
            { key: 'district:501', row: { id: 501, name: 'Old Quarter', townId: 4 } },
            { key: 'district:502', row: { id: 502, name: 'Harbour', townId: 9 } }
        ];

        it('returns the page unchanged without pinned rows', () => {
            const page = [{ id: 1, name: 'A' }];
            expect(buildPinnedSection(undefined, page, '', {})).toEqual({ pinned: [], pageItems: page });
        });

        it('shows a row in both once, pinned, with the page (database) data', () => {
            const page = [{ id: 1, name: 'A' }, { id: 501, name: 'Old Quarter (db)', townId: 4 }];
            const section = buildPinnedSection(pins, page, '', {});
            expect(section.pinned.map(p => p.row)).toEqual([
                { id: 501, name: 'Old Quarter (db)', townId: 4 },
                { id: 502, name: 'Harbour', townId: 9 }
            ]);
            expect(section.pageItems).toEqual([{ id: 1, name: 'A' }]);
        });

        it('applies the search term and filters to rows the page does not hold', () => {
            expect(buildPinnedSection(pins, [], 'harb', {}).pinned.map(p => p.key)).toEqual(['district:502']);
            expect(buildPinnedSection(pins, [], '', { townId: '4' }).pinned.map(p => p.key)).toEqual(['district:501']);
        });

        it('keeps a row the server returned even if the client could not match its filter', () => {
            const page = [{ id: 502, name: 'Harbour' }];
            const section = buildPinnedSection(pins, page, '', { siegeScenarioId: '7' });
            expect(section.pinned.map(p => p.key)).toEqual(['district:502']);
            expect(section.pageItems).toEqual([]);
        });

        it('drops duplicate and id-less pinned rows', () => {
            const section = buildPinnedSection(
                [...pins, { key: 'dup', row: { id: 501, name: 'again' } }, { key: 'concept:1', row: { name: 'no id' } }],
                [],
                '',
                {}
            );
            expect(section.pinned.map(p => p.key)).toEqual(['district:501', 'district:502']);
        });
    });
});
