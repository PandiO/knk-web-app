import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MinecraftCatalogScanCard, SCAN_POLL_INTERVAL_MS } from '../MinecraftCatalogScanCard';
import { minecraftCatalogClient } from '../../../../apiClients/minecraftCatalogClient';
import { MinecraftCatalogScanDto } from '../../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';
import { RealtimeContext, RealtimeContextValue, RealtimeHandler } from '../../../../realtime/RealtimeProvider';

// PandiO/knk-workspace#181 (DESIGN §6.5): with the web hub connected the card reads the scan when CatalogScanUpdated
// arrives instead of every 3 s.

jest.mock('../../../../apiClients/minecraftCatalogClient', () => ({
  minecraftCatalogClient: { requestScan: jest.fn(), getScans: jest.fn(), getScan: jest.fn(), cancelScan: jest.fn() },
}));

const client = minecraftCatalogClient as jest.Mocked<typeof minecraftCatalogClient>;

const scan = (overrides: Partial<MinecraftCatalogScanDto>): MinecraftCatalogScanDto => ({
  id: 7, status: 'Requested', requestedByUserId: 1, worldTaskId: 70, minecraftVersion: null, serverVersion: null,
  entryCount: null, inserted: 0, updated: 0, unchanged: 0, merged: 0, deleted: 0, markedMissing: 0, iconsMissing: 0,
  enchantmentCount: null, enchantmentsInserted: 0, enchantmentsUpdated: 0, enchantmentsUnchanged: 0, enchantmentsMerged: 0,
  enchantmentsDeleted: 0, enchantmentsMarkedMissing: 0, enchantmentDefinitionsCreated: 0, enchantmentDefinitionsLinked: 0,
  error: null, createdAt: '2026-10-21T10:00:00Z', completedAt: null,
  ...overrides,
});

function connectedHub() {
  const handlers = new Map<string, Set<RealtimeHandler<any>>>();
  const value: RealtimeContextValue = {
    connected: true,
    subscribe: (type, handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as RealtimeHandler<any>);
      return () => handlers.get(type)!.delete(handler as RealtimeHandler<any>);
    },
    onReconnected: () => () => undefined,
    joinTask: async () => true,
    leaveTask: () => undefined,
  };
  const emit = (type: string, payload: unknown) =>
    handlers.get(type)?.forEach(h => h(payload, { v: 1, seq: 2, type, at: '', payload } as never));
  return { value, emit };
}

afterEach(() => jest.useRealTimers());

it('reads the scan on CatalogScanUpdated and does not poll every 3 s while connected', async () => {
  jest.useFakeTimers();
  client.getScans.mockResolvedValue([scan({ status: 'Requested' })]);
  client.getScan.mockResolvedValue(scan({ status: 'Completed', entryCount: 1480, completedAt: '2026-10-21T10:01:00Z' }));
  const onScanFinished = jest.fn();
  const hub = connectedHub();
  render(
    <RealtimeContext.Provider value={hub.value}>
      <MinecraftCatalogScanCard onScanFinished={onScanFinished} />
    </RealtimeContext.Provider>
  );
  expect(await screen.findByText('Scan #7')).toBeInTheDocument();

  await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS * 3); });
  expect(client.getScan).not.toHaveBeenCalled();

  await act(async () => { hub.emit('CatalogScanUpdated', { scanId: 8, worldTaskId: 80, taskStatus: 'Completed' }); });
  expect(client.getScan).not.toHaveBeenCalled(); // another scan

  await act(async () => { hub.emit('CatalogScanUpdated', { scanId: 7, worldTaskId: 70, taskStatus: 'Completed' }); });
  await waitFor(() => expect(screen.getByTestId('current-scan-status')).toHaveTextContent('Completed'));
  expect(client.getScan).toHaveBeenCalledWith(7);
  expect(onScanFinished).toHaveBeenCalledWith(expect.objectContaining({ id: 7, status: 'Completed' }));
});
