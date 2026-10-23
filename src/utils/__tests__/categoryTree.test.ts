import { categoryOptions, categoryWithDescendants } from '../categoryTree';

/** KNG-263: a category filter covers the category and everything below it. */
const categories = [
    { id: '1', name: 'Weapons' },
    { id: '2', name: 'Swords', parentCategoryId: '1' },
    { id: '3', name: 'Bows', parentCategoryId: '1' },
    { id: '4', name: 'Longswords', parentCategoryId: '2' },
    { id: '5', name: 'armor' },
    { id: '6', name: 'Orphan', parentCategoryId: '99' }
];

describe('categoryWithDescendants', () => {
    it('includes children and grandchildren', () => {
        expect([...categoryWithDescendants(categories, '1')].sort()).toEqual(['1', '2', '3', '4']);
        expect([...categoryWithDescendants(categories, 2)].sort()).toEqual(['2', '4']);
    });

    it('is just the category itself without children or when unknown', () => {
        expect([...categoryWithDescendants(categories, '3')]).toEqual(['3']);
        expect([...categoryWithDescendants(categories, '42')]).toEqual(['42']);
    });

    it('survives a cycle', () => {
        const cyclic = [{ id: 1, name: 'A', parentCategoryId: 2 }, { id: 2, name: 'B', parentCategoryId: 1 }];
        expect([...categoryWithDescendants(cyclic, 1)].sort()).toEqual(['1', '2']);
    });
});

describe('categoryOptions', () => {
    it('lists parents before their children, alphabetically per level', () => {
        expect(categoryOptions(categories).map(o => `${o.depth}:${o.name}`)).toEqual([
            '0:armor', '0:Orphan', '0:Weapons', '1:Bows', '1:Swords', '2:Longswords'
        ]);
    });

    it('still lists categories that only form a cycle', () => {
        const cyclic = [{ id: 1, name: 'A', parentCategoryId: 2 }, { id: 2, name: 'B', parentCategoryId: 1 }];
        expect(categoryOptions(cyclic).map(o => o.name)).toEqual(['A', 'B']);
    });
});
