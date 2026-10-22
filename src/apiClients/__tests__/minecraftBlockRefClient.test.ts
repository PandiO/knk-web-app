import { MinecraftBlockRefClient } from '../minecraftBlockRefClient';
import { Controllers, HttpMethod } from '../../utils';

describe('MinecraftBlockRefClient', () => {
    const client = MinecraftBlockRefClient.getInstance();
    let invokeSpy: jest.SpyInstance;

    beforeEach(() => {
        invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ id: 4 });
    });

    afterEach(() => {
        invokeSpy.mockRestore();
    });

    it('getOrCreate posts the block create DTO to get-or-create (KNG-200)', async () => {
        const payload = {
            namespaceKey: 'minecraft:oak_stairs',
            blockStateString: 'minecraft:oak_stairs[facing=north]',
            logicalType: 'STAIRS',
            iconUrl: null
        };
        await expect(client.getOrCreate(payload)).resolves.toEqual({ id: 4 });
        expect(invokeSpy).toHaveBeenCalledWith(payload, 'get-or-create', Controllers.MinecraftBlockRefs, HttpMethod.Post);
    });
});
