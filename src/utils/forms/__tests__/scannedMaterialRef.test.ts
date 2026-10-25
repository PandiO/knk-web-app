import { resolveScannedMaterialRef } from '../scannedMaterialRef';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';

// KNG-200 phase 5: ItemScan and KitScan resolve the scanned material through get-or-create only;
// the hybrid lookup (getHybrid) is gone.

jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({
    minecraftMaterialRefClient: { persistFromCatalog: jest.fn(), searchPaged: jest.fn() }
}));

const client = minecraftMaterialRefClient as unknown as {
    persistFromCatalog: jest.Mock;
    searchPaged: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

describe('resolveScannedMaterialRef', () => {
    it('resolves the scanned material through get-or-create with category ITEM and no search', async () => {
        client.persistFromCatalog.mockResolvedValue({ id: 12, namespaceKey: 'minecraft:diamond_sword' });
        await expect(resolveScannedMaterialRef('minecraft:diamond_sword')).resolves.toEqual({ id: 12, namespaceKey: 'minecraft:diamond_sword' });
        expect(client.persistFromCatalog).toHaveBeenCalledTimes(1);
        expect(client.persistFromCatalog).toHaveBeenCalledWith('minecraft:diamond_sword', 'ITEM');
        expect(client.searchPaged).not.toHaveBeenCalled();
    });

    it('trims the key', async () => {
        client.persistFromCatalog.mockResolvedValue({ id: 3 });
        await resolveScannedMaterialRef('  minecraft:stone ');
        expect(client.persistFromCatalog).toHaveBeenCalledWith('minecraft:stone', 'ITEM');
    });

    it.each(['minecraft:air', 'MINECRAFT:AIR', 'air', '', '   ', undefined, null, 42])(
        'skips %p without calling the API',
        async material => {
            await expect(resolveScannedMaterialRef(material)).resolves.toBeNull();
            expect(client.persistFromCatalog).not.toHaveBeenCalled();
        }
    );

    it('passes an API error on to the caller', async () => {
        client.persistFromCatalog.mockRejectedValue(new Error('boom'));
        await expect(resolveScannedMaterialRef('minecraft:stone')).rejects.toThrow('boom');
    });
});
