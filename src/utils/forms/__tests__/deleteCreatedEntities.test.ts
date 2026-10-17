import type { CreatedEntityRecord } from '../createdEntities';
import {
    DeleteCreatedEntitiesDeps,
    deleteCreatedEntities,
    describeDeleteResult,
    remainingAfterDelete
} from '../deleteCreatedEntities';

const record = (entityTypeName: string, id: number, sequence: number, name: string): CreatedEntityRecord => ({
    entityTypeName,
    id,
    display: { name },
    origin: { formPath: ['gatestructure'], fieldName: 'x' },
    sequence
});

const district = record('District', 501, 1, 'Oostwijk');
const street = record('Street', 77, 2, 'Gatestraat');

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

function deps(overrides: Partial<{
    references: Record<string, { inUse: boolean; references?: { referencedBy: string; count: number }[] }>;
    checkError: Record<string, Error>;
    deleteError: Record<string, Error>;
    noDelete: string[];
}> = {}) {
    const calls: string[] = [];
    const checkReferences = jest.fn(async (type: string, id: number | string, ignore: string[]) => {
        calls.push(`check ${type}:${id} ignore=[${ignore.join(',')}]`);
        const key = `${type}:${id}`;
        if (overrides.checkError?.[key]) throw overrides.checkError[key];
        const found = overrides.references?.[key];
        return { entityTypeName: type, id: String(id), inUse: found?.inUse ?? false, references: found?.references ?? [] };
    });
    const getDeleteFunction = jest.fn((type: string) => {
        if (overrides.noDelete?.includes(type)) return null;
        return async (id: number | string) => {
            calls.push(`delete ${type}:${id}`);
            const error = overrides.deleteError?.[`${type}:${id}`];
            if (error) throw error;
        };
    });
    const value: DeleteCreatedEntitiesDeps = { checkReferences, getDeleteFunction };
    return { value, calls, checkReferences };
}

describe('deleteCreatedEntities (KNG-162)', () => {
    it('deletes newest first; links to entities still pending in the run are ignored', async () => {
        const d = deps();

        const results = await deleteCreatedEntities([district, street], d.value);

        expect(d.calls).toEqual([
            'check Street:77 ignore=[District:501]',
            'delete Street:77',
            'check District:501 ignore=[]',
            'delete District:501'
        ]);
        expect(results.map(r => [r.record.entityTypeName, r.outcome])).toEqual([['Street', 'deleted'], ['District', 'deleted']]);
    });

    it('skips an entity in use, names what uses it, and never calls its delete', async () => {
        const d = deps({ references: { 'District:501': { inUse: true, references: [{ referencedBy: 'Structure.DistrictId', count: 2 }, { referencedBy: 'Street (link)', count: 1 }] } } });

        const results = await deleteCreatedEntities([district, street], d.value);

        expect(d.calls).not.toContain('delete District:501');
        expect(results[1]).toEqual({ record: district, outcome: 'in-use', detail: 'used by Structure.DistrictId (2), Street (link)' });
        expect(describeDeleteResult(results[1])).toBe("District 'Oostwijk': skipped: in use (used by Structure.DistrictId (2), Street (link))");
        expect(remainingAfterDelete(results)).toEqual([district]);
    });

    it('a skipped Street still counts as using its District: the District is checked without ignoring it', async () => {
        const d = deps({ references: { 'Street:77': { inUse: true, references: [{ referencedBy: 'GateStructure.StreetId', count: 1 }] } } });

        await deleteCreatedEntities([district, street], d.value);

        expect(d.calls).toEqual([
            'check Street:77 ignore=[District:501]',
            'check District:501 ignore=[]',
            'delete District:501'
        ]);
    });

    it('reports a 409 from the delete itself as in use and a 404 as already deleted', async () => {
        const d = deps({ deleteError: {
            'Street:77': httpError(409, 'This street is still in use and can\'t be deleted.'),
            'District:501': httpError(404, 'HTTP 404: Not Found')
        } });

        const results = await deleteCreatedEntities([district, street], d.value);

        expect(results.map(r => r.outcome)).toEqual(['in-use', 'already-gone']);
        expect(describeDeleteResult(results[1])).toBe("District 'Oostwijk': already deleted");
    });

    it('fails (and deletes nothing) when the check fails or there is no delete for the type', async () => {
        const d = deps({ checkError: { 'Street:77': httpError(500, 'boom') }, noDelete: ['District'] });

        const results = await deleteCreatedEntities([district, street], d.value);

        expect(d.calls.filter(c => c.startsWith('delete'))).toEqual([]);
        expect(results.map(r => [r.outcome, r.detail])).toEqual([
            ['failed', "couldn't check whether it is in use: the request did not go through"],
            ['failed', 'the web app has no delete for District']
        ]);
        expect(remainingAfterDelete(results).map(r => r.entityTypeName)).toEqual(['District', 'Street']);
    });

    it('names an entity type the API cannot check', async () => {
        const d = deps({ checkError: { 'Street:77': httpError(404, 'Unknown entity type') } });

        const [result] = await deleteCreatedEntities([street], d.value);

        expect(result.detail).toBe("couldn't check whether it is in use: the API can't check Street");
    });
});
