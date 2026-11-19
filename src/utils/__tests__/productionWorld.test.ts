import {
    effectiveTownId,
    isProductionWorldType,
    isRuralStructure,
    placementRefusalReason,
    placementWarningsOf,
    positiveId,
    roadConnectionCell,
    roadConnectionLabel,
} from '../productionWorld';

/** P2 world (PandiO/knk-workspace#676): placement District-xor-Town, warnings and refusals of the subtype endpoints. */
describe('productionWorld', () => {
    it('recognises the two P2 structure subtypes in any case', () => {
        ['Warehouse', 'productionstructure', 'ProductionStructure'].forEach(type => expect(isProductionWorldType(type)).toBe(true));
        ['Structure', 'GateStructure', '', null, undefined].forEach(type => expect(isProductionWorldType(type)).toBe(false));
    });

    it('reads positive ids from numbers, numeric strings and picked objects', () => {
        expect(positiveId(4)).toBe(4);
        expect(positiveId('7')).toBe(7);
        expect(positiveId({ id: 8, name: 'Market' })).toBe(8);
        expect(positiveId({ Id: 9 })).toBe(9);
        [0, -1, '', ' ', 'x', null, undefined, {}].forEach(value => expect(positiveId(value)).toBeNull());
    });

    it('takes isRural from the API, else a structure with a town and no district is rural', () => {
        expect(isRuralStructure({ isRural: true, districtId: 8 })).toBe(true);
        expect(isRuralStructure({ isRural: false, townId: 4 })).toBe(false);
        expect(isRuralStructure({ districtId: null, townId: 4 })).toBe(true);
        expect(isRuralStructure({ districtId: 8, townId: null })).toBe(false);
    });

    it('the effective town is effectiveTownId, else the own town', () => {
        expect(effectiveTownId({ effectiveTownId: 4, townId: null })).toBe(4);
        expect(effectiveTownId({ effectiveTownId: null, townId: 5 })).toBe(5);
        expect(effectiveTownId({})).toBeNull();
    });

    it('names the road connection, and a structure in a district needs none (D5)', () => {
        expect(roadConnectionLabel('Unconnected')).toBe("Not connected to its town's roads");
        expect(roadConnectionLabel(undefined)).toBe('Not measured yet');
        expect(roadConnectionLabel('Maybe')).toBe('Maybe');
        expect(roadConnectionCell({ roadConnection: 'Unconnected', isRural: true })).toBe('Unconnected');
        expect(roadConnectionCell({ roadConnection: null, isRural: true })).toBe('Unmeasured');
        expect(roadConnectionCell({ roadConnection: 'Unmeasured', isRural: false })).toBe('In a district');
    });

    it('shows the sentence of a refused save ({ error }) and not a bare code', () => {
        const refusal = (status: number, response: unknown) => Object.assign(new Error(`HTTP ${status}: Bad Request`), { status, response });
        expect(placementRefusalReason(refusal(400, { error: 'Set exactly one of districtId and townId.' })))
            .toBe('Set exactly one of districtId and townId.');
        expect(placementRefusalReason(refusal(400, { error: "A rural structure (townId) has no street: leave streetId empty. (Parameter 'dto')" })))
            .toBe('A rural structure (townId) has no street: leave streetId empty.');
        expect(placementRefusalReason(refusal(400, { error: 'NotFound' }))).toBeUndefined();
        expect(placementRefusalReason(refusal(400, 'level must be 1 to 10.'))).toBe('level must be 1 to 10.');
        expect(placementRefusalReason(refusal(500, { error: 'Boom happened here' }))).toBeUndefined();
        expect(placementRefusalReason(new TypeError('Failed to fetch'))).toBeUndefined();
    });

    it('lists the placement warnings of a create once each, without blanks', () => {
        expect(placementWarningsOf({ id: 1, placementWarnings: ['P-2: not inside', ' P-2: not inside ', '', 3] })).toEqual(['P-2: not inside']);
        expect(placementWarningsOf({ id: 1 })).toEqual([]);
        expect(placementWarningsOf(undefined)).toEqual([]);
    });
});
