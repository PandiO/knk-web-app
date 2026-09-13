import { GateDoorClient } from '../gateDoorClient';
import { Controllers, HttpMethod } from '../../utils';
import { GateDoorDto, GateDoorStateUpdateDto, GateDoorHealthUpdateDto, GateDoorOperationalSettingsUpdateDto } from '../../types/dtos/gateStructure/GateDoorDto';
import { GateBlockSnapshotCreateDto } from '../../types/dtos/gateStructure/GateBlockSnapshotDto';

describe('GateDoorClient', () => {
  const client = GateDoorClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({});
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('getByStructureId lists the doors of a gate structure', async () => {
    await client.getByStructureId(14);
    expect(invokeSpy).toHaveBeenCalledWith(null, '14/doors', Controllers.GateStructures, HttpMethod.Get);
  });

  it('getById calls gate doors endpoint with id', async () => {
    await client.getById(140);
    expect(invokeSpy).toHaveBeenCalledWith(null, '140', Controllers.GateDoors, HttpMethod.Get);
  });

  it('getById supports includeSnapshots query', async () => {
    await client.getById(140, true);
    expect(invokeSpy).toHaveBeenCalledWith({ includeSnapshots: true }, '140', Controllers.GateDoors, HttpMethod.Get);
  });

  it('create posts the door payload under its parent structure', async () => {
    const payload: GateDoorDto = { gateStructureId: 14, name: 'Drawbridge' };

    await client.create(payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '14/doors', Controllers.GateStructures, HttpMethod.Post);
  });

  it('create resolves the structure id case-insensitively (dynamic FormWizard submits PascalCase field names)', async () => {
    // The dynamic FormConfiguration-driven wizard submits fields keyed by their authored
    // FormField.fieldName (PascalCase, e.g. "GateStructureId"), not GateDoorDto's own declared
    // camelCase - regression test for the "POST /api/GateStructures/undefined/doors" bug.
    const payload = { GateStructureId: 14, Name: 'Drawbridge' } as unknown as GateDoorDto;

    await client.create(payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '14/doors', Controllers.GateStructures, HttpMethod.Post);
  });

  it('update puts the door payload by its own id', async () => {
    const payload: GateDoorDto = { id: 140, gateStructureId: 14, name: 'Drawbridge' };

    await client.update(payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '140', Controllers.GateDoors, HttpMethod.Put);
  });

  it('delete removes a gate door', async () => {
    await client.delete(140);
    expect(invokeSpy).toHaveBeenCalledWith(null, '140', Controllers.GateDoors, HttpMethod.Delete);
  });

  it('updateState sends state update payload', async () => {
    const payload: GateDoorStateUpdateDto = { openedState: 'OPEN', isDestroyed: false };
    await client.updateState(140, payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '140/state', Controllers.GateDoors, HttpMethod.Put);
  });

  it('updateHealth sends health update payload', async () => {
    const payload: GateDoorHealthUpdateDto = { healthCurrent: 250 };
    await client.updateHealth(140, payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '140/health', Controllers.GateDoors, HttpMethod.Put);
  });

  it('updateOperationalSettings sends active/invincible payload', async () => {
    const payload: GateDoorOperationalSettingsUpdateDto = { isActive: true, isInvincible: false };
    await client.updateOperationalSettings(140, payload);
    expect(invokeSpy).toHaveBeenCalledWith(payload, '140/operational-settings', Controllers.GateDoors, HttpMethod.Put);
  });

  it('getSnapshots loads door snapshots', async () => {
    await client.getSnapshots(140);
    expect(invokeSpy).toHaveBeenCalledWith(null, '140/snapshots', Controllers.GateDoors, HttpMethod.Get);
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

    await client.addSnapshots(140, snapshots);
    expect(invokeSpy).toHaveBeenCalledWith(snapshots, '140/snapshots/bulk', Controllers.GateDoors, HttpMethod.Post);
  });

  it('clearSnapshots deletes snapshot records', async () => {
    await client.clearSnapshots(140);
    expect(invokeSpy).toHaveBeenCalledWith(null, '140/snapshots', Controllers.GateDoors, HttpMethod.Delete);
  });

  it('getOpenedSnapshots loads opened-block snapshots', async () => {
    await client.getOpenedSnapshots(140);
    expect(invokeSpy).toHaveBeenCalledWith(null, '140/openedSnapshots', Controllers.GateDoors, HttpMethod.Get);
  });

  it('clearOpenedSnapshots deletes opened-block snapshot records', async () => {
    await client.clearOpenedSnapshots(140);
    expect(invokeSpy).toHaveBeenCalledWith(null, '140/openedSnapshots', Controllers.GateDoors, HttpMethod.Delete);
  });
});
