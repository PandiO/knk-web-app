import { listItemKeys } from '../listItemKeys';

describe('listItemKeys (KNG-134)', () => {
    it('keys saved items by id', () => {
        expect(listItemKeys([{ id: 3 }, { id: 4 }])).toEqual(['id:3', 'id:4']);
    });

    it('gives two id-less items different keys that stay the same across renders', () => {
        const first = { name: 'A' };
        const second = { name: 'B' };
        const keys = listItemKeys([first, second]);
        expect(keys[0]).not.toEqual(keys[1]);
        // Removing the first item does not change the second item's key.
        expect(listItemKeys([second])).toEqual([keys[1]]);
    });

    it('keeps keys unique when the same id appears twice', () => {
        const keys = listItemKeys([{ id: 3 }, { id: 3 }]);
        expect(new Set(keys).size).toBe(2);
    });

    it('falls back to the position for values that are not objects', () => {
        expect(listItemKeys([null, 'x'])).toEqual(['index:0', 'index:1']);
    });
});
