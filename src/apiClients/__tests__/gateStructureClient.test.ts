import { GateStructureClient } from '../gateStructureClient';
import { Controllers, GateStructuresOperation, HttpMethod } from '../../utils';
import { PagedQueryDto } from '../../types/dtos/common/PagedQuery';
import {
  GateStructureCreateDto,
  GateStructureUpdateDto
} from '../../types/dtos/gateStructure/GateStructureDto';
import { GateStructureOverridesUpdateDto } from '../../types/dtos/gateStructure/GateStructureOverridesUpdateDto';

describe('GateStructureClient', () => {
  const client = GateStructureClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({});
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('getAll calls gate structures endpoint', async () => {
    await client.getAll();
    expect(invokeSpy).toHaveBeenCalledWith(null, GateStructuresOperation.GetAll, Controllers.GateStructures, HttpMethod.Get);
  });

  it('getById calls gate structures endpoint with id', async () => {
    await client.getById(7);
    expect(invokeSpy).toHaveBeenCalledWith(null, '7', Controllers.GateStructures, HttpMethod.Get);
  });

  it('getById supports includeSnapshots query', async () => {
    await client.getById(7, true);
    expect(invokeSpy).toHaveBeenCalledWith({ includeSnapshots: true }, '7', Controllers.GateStructures, HttpMethod.Get);
  });

  it('create posts gate structure payload', async () => {
    const payload: GateStructureCreateDto = {
      name: 'Main Gate',
      streetId: 1,
      districtId: 2,
      houseNumber: 3
    };

    await client.create(payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, GateStructuresOperation.GetAll, Controllers.GateStructures, HttpMethod.Post);
  });

  it('update puts gate structure payload', async () => {
    const payload: GateStructureUpdateDto = {
      id: 10,
      name: 'Main Gate'
    };

    await client.update(payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '10', Controllers.GateStructures, HttpMethod.Put);
  });

  it('delete removes gate structure', async () => {
    await client.delete(5);
    expect(invokeSpy).toHaveBeenCalledWith(null, '5', Controllers.GateStructures, HttpMethod.Delete);
  });

  it('getByDomain queries domain endpoint', async () => {
    await client.getByDomain(12);
    expect(invokeSpy).toHaveBeenCalledWith(null, 'domain/12', Controllers.GateStructures, HttpMethod.Get);
  });

  it('updateOverrides patches the structure-level cascading overrides', async () => {
    const payload: GateStructureOverridesUpdateDto = { isActiveOverride: true };
    await client.updateOverrides(9, payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '9/overrides', Controllers.GateStructures, HttpMethod.Patch);
  });

  it('searchPaged posts paged query', async () => {
    const query: PagedQueryDto = { page: 1, pageSize: 10 };
    await client.searchPaged(query);
    expect(invokeSpy).toHaveBeenCalledWith(query, 'search', Controllers.GateStructures, HttpMethod.Post);
  });
});
