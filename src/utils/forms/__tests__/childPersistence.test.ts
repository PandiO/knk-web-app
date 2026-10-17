import { shouldPersistChildOnComplete } from '../childPersistence';
import { FieldType } from '../../enums';

describe('shouldPersistChildOnComplete (KNG-133, D1 = A)', () => {
    it('saves a child made from a non-owned List field (Street -> Districts)', () => {
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.List, objectType: 'District' })).toBe(true);
    });

    it('saves a child made from an owned-collection List field (GateStructure -> GateDoors)', () => {
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.List, objectType: 'GateDoor' })).toBe(true);
    });

    it('saves a Location made from a List field, which the API only takes as ids', () => {
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.List, objectType: 'Location' })).toBe(true);
    });

    it('saves a child made from a single Object field', () => {
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.Object, objectType: 'Street' })).toBe(true);
    });

    it('keeps a single Location embedded (saved with its parent)', () => {
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.Object, objectType: 'Location' })).toBe(false);
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.Object, objectType: 'location' })).toBe(false);
    });

    it('never saves anything for a field without an object type', () => {
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.List, objectType: undefined })).toBe(false);
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.Object, objectType: undefined })).toBe(false);
        expect(shouldPersistChildOnComplete({ fieldType: FieldType.String, objectType: 'District' })).toBe(false);
    });
});
