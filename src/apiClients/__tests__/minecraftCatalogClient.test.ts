import { MinecraftCatalogClient } from '../minecraftCatalogClient';
import { Controllers, HttpMethod } from '../../utils';

// KNG-200 phase 3: the client speaks the api/MinecraftCatalog route table of plan §5.2a.

describe('MinecraftCatalogClient', () => {
  const client = MinecraftCatalogClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('uses the MinecraftCatalog controller', () => {
    expect(Controllers.MinecraftCatalog).toBe('MinecraftCatalog');
  });

  it('requests, lists, reads and cancels scans', async () => {
    await client.requestScan();
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'scans', Controllers.MinecraftCatalog, HttpMethod.Post);

    await client.getScans();
    expect(invokeSpy).toHaveBeenLastCalledWith({ take: 20 }, 'scans', Controllers.MinecraftCatalog, HttpMethod.Get);

    await client.getScans(5);
    expect(invokeSpy).toHaveBeenLastCalledWith({ take: 5 }, 'scans', Controllers.MinecraftCatalog, HttpMethod.Get);

    await client.getScan(7);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'scans/7', Controllers.MinecraftCatalog, HttpMethod.Get);

    await client.cancelScan(7);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'scans/7/cancel', Controllers.MinecraftCatalog, HttpMethod.Post);
  });

  it('reads the audit and runs the backfill', async () => {
    await client.getAudit();
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'audit', Controllers.MinecraftCatalog, HttpMethod.Get);

    await client.runBackfill();
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'backfill', Controllers.MinecraftCatalog, HttpMethod.Post);
  });

  it('merges a material into another', async () => {
    await client.mergeMaterial(12, 3);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, 'materials/12/merge-into/3', Controllers.MinecraftCatalog, HttpMethod.Post);
  });

  it('sets and clears an icon override', async () => {
    await client.setIconOverride(4, 'https://example.org/stone.png');
    expect(invokeSpy).toHaveBeenLastCalledWith(
      { iconUrlOverride: 'https://example.org/stone.png' }, 'materials/4/icon-override', Controllers.MinecraftCatalog, HttpMethod.Put);

    await client.setIconOverride(4, null);
    expect(invokeSpy).toHaveBeenLastCalledWith(
      { iconUrlOverride: null }, 'materials/4/icon-override', Controllers.MinecraftCatalog, HttpMethod.Put);
  });
});
