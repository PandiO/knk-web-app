import { readRefusalMessage } from '../readRefusal';

// PandiO/knk-workspace#280: a refused read in words.
describe('readRefusalMessage', () => {
    it('names the type and the nodes of a NoReadAccess refusal', () => {
        const error = Object.assign(new Error('Forbidden'), {
            status: 403, response: { code: 'NoReadAccess', entityType: 'Town', nodes: ['knk.admin.world', 'knk.admin.config'] },
        });
        expect(readRefusalMessage(error, 'Towns')).toBe("You don't have access to Towns. Requires one of: knk.admin.world, knk.admin.config.");
        const one = Object.assign(new Error('x'), { status: 403, response: { code: 'NoReadAccess', nodes: ['knk.admin.content'] } });
        expect(readRefusalMessage(one, 'Item blueprints')).toBe("You don't have access to Item blueprints. Requires knk.admin.content.");
    });

    it('uses the API message of another 403 and ignores other statuses', () => {
        const other = Object.assign(new Error('Requires a staff area permission.'), { status: 403, response: { message: 'Requires a staff area permission.' } });
        expect(readRefusalMessage(other, 'Towns')).toBe("You don't have access to Towns. Requires a staff area permission.");
        expect(readRefusalMessage(Object.assign(new Error('HTTP 403: Forbidden'), { status: 403 }), 'Towns')).toBe("You don't have access to Towns.");
        expect(readRefusalMessage(Object.assign(new Error('x'), { status: 500 }), 'Towns')).toBeUndefined();
        expect(readRefusalMessage(new Error('offline'), 'Towns')).toBeUndefined();
    });
});
