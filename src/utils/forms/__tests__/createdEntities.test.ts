import type { SessionEntity } from '../../../contexts/FormSessionContext';
import {
    createdEntityLabel,
    deletionOrder,
    describeCreatedEntity,
    parseCreatedEntitiesJson,
    pickLabelFields,
    serializeCreatedEntities,
    toCreatedEntityRecords
} from '../createdEntities';

const entry = (overrides: Partial<SessionEntity>): SessionEntity => ({
    key: 'district:1',
    entityTypeName: 'District',
    id: 1,
    display: { id: 1, name: 'Oostwijk' },
    origin: { formPath: ['gatestructure', 'Street'], fieldName: 'Districts' },
    status: 'created',
    embedded: false,
    sequence: 1,
    revision: 1,
    ...overrides
});

describe('createdEntities (KNG-162)', () => {
    it('turns created, non-embedded registry entries into records, oldest first, with label fields only', () => {
        const records = toCreatedEntityRecords([
            entry({ key: 'street:7', entityTypeName: 'Street', id: 7, display: { id: 7, name: 'Gatestraat', districtIds: [1] }, sequence: 2, origin: { formPath: ['gatestructure'], fieldName: 'StreetId' } }),
            entry({}),
            entry({ key: 'gatedoor:3', entityTypeName: 'GateDoor', id: 3, status: 'updated', sequence: 3 }),
            entry({ key: 'concept:1', entityTypeName: 'Location', id: undefined, embedded: true, sequence: 4 })
        ]);

        expect(records).toEqual([
            { entityTypeName: 'District', id: 1, display: { name: 'Oostwijk' }, origin: { formPath: ['gatestructure', 'Street'], fieldName: 'Districts' }, sequence: 1 },
            { entityTypeName: 'Street', id: 7, display: { name: 'Gatestraat' }, origin: { formPath: ['gatestructure'], fieldName: 'StreetId' }, sequence: 2 }
        ]);
    });

    it('keeps string and number label fields and drops the rest', () => {
        expect(pickLabelFields({ name: 'A', displayName: '', title: 3, key: null, other: 'x' })).toEqual({ name: 'A', title: 3 });
        expect(pickLabelFields(undefined)).toEqual({});
    });

    it('labels by the first label field, else by id', () => {
        expect(createdEntityLabel({ id: 5, display: { displayName: 'North Gate' } })).toBe('North Gate');
        expect(createdEntityLabel({ id: 5, display: {} })).toBe('#5');
        expect(describeCreatedEntity({ entityTypeName: 'District', id: 1, display: { name: 'Oostwijk' }, origin: { formPath: [], fieldName: '' }, sequence: 1 }))
            .toBe("District 'Oostwijk'");
    });

    it('round-trips through JSON', () => {
        const records = toCreatedEntityRecords([entry({})]);
        expect(parseCreatedEntitiesJson(serializeCreatedEntities(records))).toEqual(records);
    });

    it('parses tolerantly: bad JSON, non-arrays and unusable items are dropped; missing sequence uses the position', () => {
        expect(parseCreatedEntitiesJson(undefined)).toEqual([]);
        expect(parseCreatedEntitiesJson('  ')).toEqual([]);
        expect(parseCreatedEntitiesJson('{not json')).toEqual([]);
        expect(parseCreatedEntitiesJson('{"a":1}')).toEqual([]);

        const parsed = parseCreatedEntitiesJson(JSON.stringify([
            { entityTypeName: 'Street', id: 7 },
            null,
            { entityTypeName: '', id: 3 },
            { entityTypeName: 'Town', id: '' },
            { entityTypeName: 'District', id: 1, sequence: 0, display: { name: 'Oostwijk', secret: 'x' }, origin: { formPath: ['a', 3], fieldName: 'Districts' } }
        ]));

        expect(parsed).toEqual([
            { entityTypeName: 'District', id: 1, display: { name: 'Oostwijk' }, origin: { formPath: ['a'], fieldName: 'Districts' }, sequence: 0 },
            { entityTypeName: 'Street', id: 7, display: {}, origin: { formPath: [], fieldName: '' }, sequence: 1 }
        ]);
    });

    it('deletes newest first (the Street before the District it references)', () => {
        const records = toCreatedEntityRecords([
            entry({}),
            entry({ key: 'street:7', entityTypeName: 'Street', id: 7, sequence: 2 })
        ]);
        expect(deletionOrder(records).map(r => r.entityTypeName)).toEqual(['Street', 'District']);
        // The input is not reordered.
        expect(records.map(r => r.entityTypeName)).toEqual(['District', 'Street']);
    });
});
