import { DisplayConfigClient } from '../displayConfigClient';
import { Controllers, HttpMethod } from '../../utils';
import { DisplayConfigurationDto } from '../../types/dtos/displayConfig/DisplayModels';

describe('DisplayConfigClient', () => {
  const client = DisplayConfigClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({});
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  // Update/Delete are '' in DisplayConfigurationOperation, so building the path as
  // `${operation}/${id}` produced "/5" -> PUT/DELETE api/DisplayConfigurations//5 (404).
  it('update puts to DisplayConfigurations/{id} with no empty path segment', async () => {
    const config = { id: '5', name: 'ItemBlueprint Display', entityTypeName: 'ItemBlueprint', isDefault: true } as unknown as DisplayConfigurationDto;

    await client.update(5, config);
    expect(invokeSpy).toHaveBeenCalledWith(config, '5', Controllers.DisplayConfigurations, HttpMethod.Put);
  });

  it('delete targets DisplayConfigurations/{id} with no empty path segment', async () => {
    await client.delete(5);
    expect(invokeSpy).toHaveBeenCalledWith(null, '5', Controllers.DisplayConfigurations, HttpMethod.Delete);
  });

  it('getById uses the same DisplayConfigurations/{id} path', async () => {
    await client.getById(5);
    expect(invokeSpy).toHaveBeenCalledWith(null, '5', Controllers.DisplayConfigurations, HttpMethod.Get);
  });
});
