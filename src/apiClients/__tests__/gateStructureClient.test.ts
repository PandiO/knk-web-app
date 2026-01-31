import { GateStructureClient } from '../gateStructureClient';
import { Controllers, GateStructuresOperation, HttpMethod } from '../../utils';
import { PagedQueryDto } from '../../types/dtos/common/PagedQuery';
import {
  GateStateUpdateDto,
  GateStructureCreateDto,
  GateStructureUpdateDto
} from '../../types/dtos/gateStructure/GateStructureDto';
import { GateBlockSnapshotCreateDto } from '../../types/dtos/gateStructure/GateBlockSnapshotDto';

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
      name: 'Main Gate',
      isActive: true,
      healthMax: 500,
      isInvincible: true,
      canRespawn: true,
      respawnRateSeconds: 300,
      animationDurationTicks: 60,
      animationTickRate: 1
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

  it('updateState sends state update payload', async () => {
    const payload: GateStateUpdateDto = { isOpened: true, isDestroyed: false };
    await client.updateState(9, payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '9/state', Controllers.GateStructures, HttpMethod.Put);
  });

  it('getSnapshots loads gate snapshots', async () => {
    await client.getSnapshots(4);
    expect(invokeSpy).toHaveBeenCalledWith(null, '4/snapshots', Controllers.GateStructures, HttpMethod.Get);
  });

  it('addSnapshots posts snapshot payloads', async () => {
    const snapshots: GateBlockSnapshotCreateDto[] = [
      {
        relativeX: 0,
        relativeY: 1,
        relativeZ: 2,
        worldX: 100,
        worldY: 64,
        worldZ: 200,
        materialName: 'minecraft:stone',
        sortOrder: 0
      }
    ];

    await client.addSnapshots(4, snapshots);
    expect(invokeSpy).toHaveBeenCalledWith(snapshots, '4/snapshots/bulk', Controllers.GateStructures, HttpMethod.Post);
  });

  it('clearSnapshots deletes snapshot records', async () => {
    await client.clearSnapshots(4);
    expect(invokeSpy).toHaveBeenCalledWith(null, '4/snapshots', Controllers.GateStructures, HttpMethod.Delete);
  });

  it('searchPaged posts paged query', async () => {
    const query: PagedQueryDto = { page: 1, pageSize: 10 };
    await client.searchPaged(query);
    expect(invokeSpy).toHaveBeenCalledWith(query, 'search', Controllers.GateStructures, HttpMethod.Post);
  });
});
