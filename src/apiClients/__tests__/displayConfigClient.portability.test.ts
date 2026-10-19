import { displayConfigClient } from '../displayConfigClient';
import { serviceCall } from '../../services/serviceCall';
import { Controllers, HttpMethod } from '../../utils';

/** knk-displayconfig/1 export/import/seed calls; an import refusal (400/409 with a result body) resolves instead of rejecting. */
describe('DisplayConfigClient portability', () => {
    let invokeSpy: jest.SpyInstance;
    let apiSpy: jest.SpyInstance;

    beforeEach(() => {
        invokeSpy = jest.spyOn(displayConfigClient as any, 'invokeServiceCall').mockResolvedValue({});
        apiSpy = jest.spyOn(serviceCall, 'invokeApiService');
    });

    afterEach(() => {
        invokeSpy.mockRestore();
        apiSpy.mockRestore();
    });

    const answer = (outcome: { success?: unknown; error?: unknown }) =>
        apiSpy.mockImplementation(async (args: any) => {
            if ('success' in outcome) args.responseHandler.success(outcome.success);
            else args.responseHandler.error(outcome.error);
        });

    it('exports and lists seeds with GETs', async () => {
        await displayConfigClient.exportConfiguration('4');
        await displayConfigClient.getSeeds();
        expect(invokeSpy).toHaveBeenCalledWith(null, '4/export', Controllers.DisplayConfigurations, HttpMethod.Get);
        expect(invokeSpy).toHaveBeenCalledWith(null, 'seeds', Controllers.DisplayConfigurations, HttpMethod.Get);
    });

    it('posts the file with dryRun, makeDefault and asDraft in the query', async () => {
        const passed = { status: 'DryRunPassed', errors: [], warnings: [] };
        answer({ success: passed });

        const result = await displayConfigClient.importConfiguration({ format: 'knk-displayconfig/1' }, { dryRun: true, makeDefault: false, asDraft: true });

        expect(result).toBe(passed);
        expect(apiSpy).toHaveBeenCalledWith(expect.objectContaining({
            operation: 'import?dryRun=true&makeDefault=false&asDraft=true',
            controller: Controllers.DisplayConfigurations,
            httpMethod: HttpMethod.Post,
            requestData: { format: 'knk-displayconfig/1' }
        }));
    });

    it('imports a seed by its encoded name', async () => {
        answer({ success: { status: 'Imported', errors: [], warnings: [] } });

        await displayConfigClient.importSeed('User.display', { dryRun: false, makeDefault: true, asDraft: false });

        expect(apiSpy).toHaveBeenCalledWith(expect.objectContaining({ operation: 'seeds/User.display/import?dryRun=false&makeDefault=true&asDraft=false' }));
    });

    it('resolves with the result body of a refused import', async () => {
        const refused = { status: 'AlreadyImported', errors: [], warnings: [], displayConfigurationId: '9' };
        const error = Object.assign(new Error('conflict'), { status: 409, response: refused });
        answer({ error });

        await expect(displayConfigClient.importConfiguration({}, { dryRun: true, makeDefault: false, asDraft: false })).resolves.toBe(refused);
    });

    it('rejects other failures', async () => {
        const error = Object.assign(new Error('Forbidden'), { status: 403, response: { message: 'Forbidden' } });
        answer({ error });

        await expect(displayConfigClient.importSeed('X', { dryRun: true, makeDefault: false, asDraft: false })).rejects.toBe(error);
    });
});
