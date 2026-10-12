import { formConfigClient } from '../formConfigClient';
import { serviceCall } from '../../services/serviceCall';
import { Controllers, HttpMethod } from '../../utils';

/** KNG-138: export/import/seed calls; an import refusal (400/409 with a result body) resolves instead of rejecting. */
describe('FormConfigClient portability', () => {
    let invokeSpy: jest.SpyInstance;
    let apiSpy: jest.SpyInstance;

    beforeEach(() => {
        invokeSpy = jest.spyOn(formConfigClient as any, 'invokeServiceCall').mockResolvedValue({});
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
        await formConfigClient.exportConfiguration('9');
        await formConfigClient.getSeeds();
        expect(invokeSpy).toHaveBeenCalledWith(null, '9/export', Controllers.FormConfigurations, HttpMethod.Get);
        expect(invokeSpy).toHaveBeenCalledWith(null, 'seeds', Controllers.FormConfigurations, HttpMethod.Get);
    });

    it('posts the file with dryRun and makeDefault in the query', async () => {
        const passed = { status: 'DryRunPassed', errors: [], warnings: [] };
        answer({ success: passed });

        const result = await formConfigClient.importConfiguration({ format: 'knk-formconfig/1' }, { dryRun: true, makeDefault: false });

        expect(result).toBe(passed);
        expect(apiSpy).toHaveBeenCalledWith(expect.objectContaining({
            operation: 'import?dryRun=true&makeDefault=false',
            controller: Controllers.FormConfigurations,
            httpMethod: HttpMethod.Post,
            requestData: { format: 'knk-formconfig/1' }
        }));
    });

    it('imports a seed by its encoded name', async () => {
        answer({ success: { status: 'Imported', errors: [], warnings: [] } });

        await formConfigClient.importSeed('Siege Scenario', { dryRun: false, makeDefault: true });

        expect(apiSpy).toHaveBeenCalledWith(expect.objectContaining({ operation: 'seeds/Siege%20Scenario/import?dryRun=false&makeDefault=true' }));
    });

    it('resolves with the result body of a refused import', async () => {
        const refused = { status: 'AlreadyImported', errors: [], warnings: [], formConfigurationId: '9' };
        const error = Object.assign(new Error('conflict'), { status: 409, response: refused });
        answer({ error });

        await expect(formConfigClient.importConfiguration({}, { dryRun: true, makeDefault: false })).resolves.toBe(refused);
    });

    it('rejects other failures', async () => {
        const error = Object.assign(new Error('Forbidden'), { status: 403, response: { message: 'Forbidden' } });
        answer({ error });

        await expect(formConfigClient.importSeed('X', { dryRun: true, makeDefault: false })).rejects.toBe(error);
    });
});
