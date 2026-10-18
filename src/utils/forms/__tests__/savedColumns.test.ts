import { ColumnDefinition } from '../../../types/common';
import { matchBuiltInColumn } from '../savedColumns';

const builtIn: ColumnDefinition<any>[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'streetName', label: 'Street', sortable: false },
    { key: 'townName', label: 'Town', sortable: false },
    { key: 'doorCount', label: 'Doors', sortable: false },
];

describe('matchBuiltInColumn', () => {
    it('matches the same key regardless of case', () => {
        expect(matchBuiltInColumn('Name', builtIn)?.key).toBe('name');
        expect(matchBuiltInColumn('doorcount', builtIn)?.key).toBe('doorCount');
    });

    it('matches a saved navigation to the built-in "...Name" column', () => {
        expect(matchBuiltInColumn('Town', builtIn)?.key).toBe('townName');
        expect(matchBuiltInColumn('Street', builtIn)?.key).toBe('streetName');
    });

    it('matches a column by its label', () => {
        expect(matchBuiltInColumn('Doors', builtIn)?.key).toBe('doorCount');
    });

    it('leaves a key with no built-in column alone', () => {
        expect(matchBuiltInColumn('TownId', builtIn)).toBeUndefined();
        expect(matchBuiltInColumn('WgRegionId', builtIn)).toBeUndefined();
    });
});
