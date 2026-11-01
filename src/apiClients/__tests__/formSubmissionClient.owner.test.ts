import { FormSubmissionClient } from '../formSubmissionClient';
import { Controllers, FormSubmissionProgressOperation, HttpMethod } from '../../utils/enums';

// #186: the API takes the owner of a draft from the logged-in user, so the client never sends a user id.
describe('FormSubmissionClient: drafts belong to the logged-in user', () => {
    const client = FormSubmissionClient.getInstance();
    let invokeSpy: jest.SpyInstance;

    beforeEach(() => {
        invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue([]);
    });

    afterEach(() => invokeSpy.mockRestore());

    it('asks for the own drafts of a type with mine=true and no userId', async () => {
        await client.getByEntityTypeName('Town', true);
        expect(invokeSpy).toHaveBeenCalledWith(
            { entityTypeName: 'Town', isSummary: true, mine: true },
            FormSubmissionProgressOperation.GetByEntityTypeName,
            Controllers.FormSubmissionProgress,
            HttpMethod.Get
        );
    });

    it('lists every owner for the relationship drafts of a parent (no mine)', async () => {
        await client.getByEntityTypeNameFiltered('GateDoor', 'GateStructureId', '14');
        expect(invokeSpy.mock.calls[0][0]).toEqual({ entityTypeName: 'GateDoor', isSummary: true, propertyName: 'GateStructureId', propertyValue: '14' });
    });

    it('gets the own drafts without a user id', async () => {
        await client.getMine();
        expect(invokeSpy).toHaveBeenCalledWith(null, FormSubmissionProgressOperation.GetByUser, Controllers.FormSubmissionProgress, HttpMethod.Get);
    });
});
