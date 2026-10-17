import {
    joinNames,
    pickerDistrictName,
    pickerDistrictNames,
    pickerStreetAddress,
    pickerStreetName,
    pickerTownName,
    pickerTownNames,
    pickerWorldName
} from '../pickerRowValues';
import { columnDefinitionsRegistry } from '../../../config/objectConfigs';

/**
 * KNG-166: a search row (the API's list DTO) and a pinned row (the full read DTO a child form's
 * save returned) of the same record show the same picker values.
 */
describe('pickerRowValues (KNG-166)', () => {
    describe('District', () => {
        const listRow = { id: 4, name: 'Harbour', townId: 2, townName: 'York', worldName: 'world' };
        const readRow = { id: 4, name: 'Harbour', townId: 2, town: { id: 2, name: 'York' }, worldName: 'world' };

        it('shows the town from both shapes', () => {
            expect(pickerTownName(listRow)).toBe('York');
            expect(pickerTownName(readRow)).toBe('York');
        });

        it('has no town when neither shape names one', () => {
            expect(pickerTownName({ id: 4, townId: 2 })).toBeUndefined();
            expect(pickerTownName({ id: 4, townName: null, town: null })).toBeUndefined();
        });
    });

    describe('Street', () => {
        const listRow = { id: 7, name: 'Main Street', districtNames: 'harbour, Market', townNames: 'York' };
        const readRow = {
            id: 7,
            name: 'Main Street',
            districtIds: [5, 4, 6],
            districts: [
                { id: 5, name: 'Market', town: { id: 2, name: 'York' } },
                { id: 4, name: 'harbour', town: { id: 2, name: 'York' } },
                { id: 6, name: 'Market', town: null }
            ]
        };

        it('shows the districts and their towns from both shapes, sorted A-Z ignoring case', () => {
            expect(pickerDistrictNames(listRow)).toBe('harbour, Market');
            expect(pickerDistrictNames(readRow)).toBe('harbour, Market');
            expect(pickerTownNames(listRow)).toBe('York');
            expect(pickerTownNames(readRow)).toBe('York');
        });

        it('has nothing to show for a street without districts', () => {
            expect(pickerDistrictNames({ id: 8, districtNames: null, townNames: null })).toBeUndefined();
            expect(pickerDistrictNames({ id: 8, districts: [] })).toBeUndefined();
            expect(pickerTownNames({ id: 8, districts: [{ name: 'Lonely' }] })).toBeUndefined();
        });
    });

    describe('Structure / GateStructure', () => {
        const listRow = {
            id: 11, name: 'Smithy', streetId: 7, streetName: 'Main Street', houseNumber: 12,
            districtId: 4, districtName: 'Harbour', townName: 'York', worldName: 'world'
        };
        const readRow = {
            id: 11, name: 'Smithy', streetId: 7, districtId: 4, houseNumber: 12, worldName: 'world',
            street: { id: 7, name: 'Main Street' },
            district: { id: 4, name: 'Harbour', town: { id: 2, name: 'York' } }
        };

        it('shows street + house number, district and town from both shapes', () => {
            for (const row of [listRow, readRow]) {
                expect(pickerStreetAddress(row)).toBe('Main Street 12');
                expect(pickerDistrictName(row)).toBe('Harbour');
                expect(pickerTownName(row)).toBe('York');
                expect(pickerWorldName(row)).toBe('world');
            }
        });

        it('leaves out an unset house number and reads PascalCase properties', () => {
            expect(pickerStreetAddress({ streetName: 'Main Street', houseNumber: 0 })).toBe('Main Street');
            expect(pickerStreetAddress({ houseNumber: 3 })).toBe('3');
            expect(pickerStreetAddress({})).toBeUndefined();
            expect(pickerStreetName({ Street: { Id: 7, Name: 'Main Street' } })).toBe('Main Street');
            expect(pickerDistrictName({ District: { Name: 'Harbour' } })).toBe('Harbour');
        });

        it('reads the town of the nested district when it carries townName', () => {
            expect(pickerTownName({ district: { id: 4, name: 'Harbour', townName: 'York' } })).toBe('York');
        });
    });

    it('joinNames matches the API: trimmed, distinct, sorted ignoring case, ", "-joined', () => {
        expect(joinNames([' b ', 'A', 'b', undefined, '', 'a'])).toBe('A, a, b');
        expect(joinNames([undefined, ' '])).toBeUndefined();
    });

    it('worldName ignores empty values', () => {
        expect(pickerWorldName({ worldName: '' })).toBeUndefined();
        expect(pickerWorldName({ WorldName: 'nether' })).toBe('nether');
        expect(pickerWorldName(null)).toBeUndefined();
    });
});

describe('picker column definitions (KNG-166)', () => {
    const renderColumns = (type: string, row: Record<string, unknown>) =>
        columnDefinitionsRegistry[type].default
            .filter(column => column.render)
            .map(column => [column.key, column.render!(row)]);

    it('renders the same street, district and town for a search row and a pinned row', () => {
        const listRow = {
            id: 11, name: 'Smithy', streetName: 'Main Street', houseNumber: 12, districtName: 'Harbour',
            townName: 'York', worldName: 'world', doorCount: 1
        };
        const readRow = {
            id: 11, name: 'Smithy', houseNumber: 12, worldName: 'world',
            street: { id: 7, name: 'Main Street' }, district: { id: 4, name: 'Harbour', town: { id: 2, name: 'York' } }
        };
        expect(renderColumns('structure', readRow)).toEqual(renderColumns('structure', listRow));
        expect(renderColumns('gatestructure', readRow)).toEqual(renderColumns('gatestructure', listRow));
        expect(renderColumns('structure', listRow)).toEqual([
            ['streetName', 'Main Street 12'],
            ['districtName', 'Harbour'],
            ['townName', 'York'],
            ['worldName', 'world']
        ]);
    });

    it('renders the same districts and towns for a street search row and a pinned street', () => {
        const listRow = { id: 7, name: 'Main Street', districtNames: 'Harbour', townNames: 'York' };
        const readRow = { id: 7, name: 'Main Street', districts: [{ id: 4, name: 'Harbour', town: { id: 2, name: 'York' } }] };
        expect(renderColumns('street', readRow)).toEqual(renderColumns('street', listRow));
        expect(renderColumns('street', listRow)).toEqual([['districtNames', 'Harbour'], ['townNames', 'York']]);
    });

    it('renders the same town for a district search row and a pinned district', () => {
        const listRow = { id: 4, name: 'Harbour', townName: 'York', worldName: 'world' };
        const readRow = { id: 4, name: 'Harbour', town: { id: 2, name: 'York' }, worldName: 'world' };
        expect(renderColumns('district', readRow)).toEqual(renderColumns('district', listRow));
    });

    it('shows "-" when a value is missing', () => {
        expect(renderColumns('district', { id: 4, name: 'Harbour' })).toEqual([['townName', '-'], ['worldName', '-']]);
    });
});
