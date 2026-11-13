import { fetchByIdOrLookup } from '../fetchOrLookup';
import { getFetchByIdFunctionForEntity } from '../entityApiMapping';
import { lookupClient } from '../../apiClients/lookupClient';

jest.mock('../entityApiMapping', () => ({ getFetchByIdFunctionForEntity: jest.fn() }));
jest.mock('../../apiClients/lookupClient', () => ({ lookupClient: { get: jest.fn() } }));

// PandiO/knk-workspace#280: a label without a read node comes from the lookup.
describe('fetchByIdOrLookup', () => {
    it('reads the record with the type\'s own GET when allowed', async () => {
        const fetch = jest.fn().mockResolvedValue({ id: 4, name: 'Cinix', population: 9 });
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(fetch);
        await expect(fetchByIdOrLookup('Town', 4)).resolves.toEqual({ id: 4, name: 'Cinix', population: 9 });
        expect(fetch).toHaveBeenCalledWith('4');
        expect(lookupClient.get).not.toHaveBeenCalled();
    });

    it('falls back to the lookup on a 403 and passes other failures on', async () => {
        const fetch = jest.fn().mockRejectedValueOnce(Object.assign(new Error('no'), { status: 403 }));
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(fetch);
        (lookupClient.get as jest.Mock).mockResolvedValue({ id: 4, label: 'Cinix', detail: 'Domain' });
        await expect(fetchByIdOrLookup('Town', 4)).resolves.toEqual({ id: 4, name: 'Cinix' });
        expect(lookupClient.get).toHaveBeenCalledWith('Town', 4);

        fetch.mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 404 }));
        await expect(fetchByIdOrLookup('Town', 5)).rejects.toThrow('gone');
    });
});
