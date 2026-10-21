import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MinecraftCatalogAdminPage } from '../MinecraftCatalogAdminPage';
import { minecraftCatalogClient } from '../../../apiClients/minecraftCatalogClient';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { SCAN_POLL_INTERVAL_MS } from '../../../components/admin/minecraftCatalog/MinecraftCatalogScanCard';
import {
  MinecraftCatalogAuditDto,
  MinecraftCatalogAuditMaterialDto,
  MinecraftCatalogScanDto,
} from '../../../types/dtos/minecraftCatalog/MinecraftCatalogDtos';

// KNG-200 phase 3: the Minecraft catalogue admin page - scan, poll, 409, merges and icon overrides.

jest.mock('../../../apiClients/minecraftCatalogClient', () => ({
  minecraftCatalogClient: {
    requestScan: jest.fn(),
    getScans: jest.fn(),
    getScan: jest.fn(),
    cancelScan: jest.fn(),
    getAudit: jest.fn(),
    runBackfill: jest.fn(),
    mergeMaterial: jest.fn(),
    setIconOverride: jest.fn(),
  },
}));
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({
  minecraftMaterialRefClient: { searchPaged: jest.fn() },
}));

const client = minecraftCatalogClient as jest.Mocked<typeof minecraftCatalogClient>;
const materials = minecraftMaterialRefClient as jest.Mocked<typeof minecraftMaterialRefClient>;

const scan = (overrides: Partial<MinecraftCatalogScanDto>): MinecraftCatalogScanDto => ({
  id: 7, status: 'Requested', requestedByUserId: 1, worldTaskId: 70, minecraftVersion: null, serverVersion: null,
  entryCount: null, inserted: 0, updated: 0, unchanged: 0, merged: 0, deleted: 0, markedMissing: 0, iconsMissing: 0,
  error: null, createdAt: '2026-10-21T10:00:00Z', completedAt: null,
  ...overrides,
});

const material = (overrides: Partial<MinecraftCatalogAuditMaterialDto>): MinecraftCatalogAuditMaterialDto => ({
  id: 1, namespaceKey: 'minecraft:stone', normalizedKey: 'minecraft:stone', displayName: 'Stone', catalogStatus: 'Active',
  references: {}, totalReferences: 0,
  ...overrides,
});

const emptyAudit = (overrides: Partial<MinecraftCatalogAuditDto> = {}): MinecraftCatalogAuditDto => ({
  readyForConstraints: true, materialCount: 1200, unverifiedCount: 0,
  materialKeyCollisions: [], invalidMaterialKeys: [], notNormalizedMaterialKeys: [], missingIcons: [], missingButReferenced: [],
  blockRefCount: 30, duplicateBlockStates: [], invalidBlockStates: [], unlinkedBlockRefs: [], notCanonicalBlockRefs: [],
  ...overrides,
});

const grassPath = material({
  id: 40, namespaceKey: 'minecraft:grass_path', normalizedKey: 'minecraft:grass_path', displayName: 'Grass Path',
  catalogStatus: 'Missing', references: { 'ItemBlueprint.IconMaterialRefId': 2, 'Category.IconMaterialRefId': 1 }, totalReferences: 3,
});

beforeEach(() => {
  jest.clearAllMocks();
  client.getScans.mockResolvedValue([]);
  client.getAudit.mockResolvedValue(emptyAudit());
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MinecraftCatalogAdminPage - server scan', () => {
  it('starts a scan and polls it every few seconds until it completes', async () => {
    jest.useFakeTimers();
    client.requestScan.mockResolvedValue(scan({ status: 'Requested' }));
    client.getScan
      .mockResolvedValueOnce(scan({ status: 'Running' }))
      .mockResolvedValueOnce(scan({ status: 'Ingesting', minecraftVersion: '1.21.10', entryCount: 1480 }))
      .mockResolvedValueOnce(scan({
        status: 'Completed', minecraftVersion: '1.21.10', entryCount: 1480, inserted: 12, updated: 30, unchanged: 1438,
        markedMissing: 1, completedAt: '2026-10-21T10:01:00Z',
      }));

    render(<MinecraftCatalogAdminPage />);
    expect(await screen.findByText(/No scan yet/)).toBeInTheDocument();
    expect(screen.getByText(/must be running with knk-plugin/)).toBeInTheDocument();
    expect(client.getAudit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Scan server' }));
    expect(await screen.findByText('Scan #7')).toBeInTheDocument();
    expect(client.requestScan).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-scan-status')).toHaveTextContent('Requested');
    expect(screen.getByRole('button', { name: 'Scan server' })).toBeDisabled();
    expect(client.getScan).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS); });
    await waitFor(() => expect(screen.getByTestId('current-scan-status')).toHaveTextContent('Running'));
    expect(client.getScan).toHaveBeenCalledWith(7);

    await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS); });
    await waitFor(() => expect(screen.getByTestId('current-scan-status')).toHaveTextContent('Ingesting'));

    await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS); });
    await waitFor(() => expect(screen.getByTestId('current-scan-status')).toHaveTextContent('Completed'));
    expect(client.getScan).toHaveBeenCalledTimes(3);

    // The finished scan refreshes the audit, and polling stops.
    await waitFor(() => expect(client.getAudit).toHaveBeenCalledTimes(2));
    const latest = screen.getByRole('group', { name: 'Latest scan' });
    expect(within(latest).getByText('1438')).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS * 5); });
    expect(client.getScan).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Scan server' })).toBeEnabled();
  });

  it('picks up an active scan on load and stops polling when the page is left', async () => {
    jest.useFakeTimers();
    client.getScans.mockResolvedValue([scan({ id: 9, status: 'Running' }), scan({ id: 8, status: 'Completed' })]);
    client.getScan.mockResolvedValue(scan({ id: 9, status: 'Running' }));

    const { unmount } = render(<MinecraftCatalogAdminPage />);
    expect(await screen.findByText('Scan #9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel scan' })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Recent scans' })).getAllByRole('row')).toHaveLength(3);

    await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS); });
    await waitFor(() => expect(client.getScan).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => { jest.advanceTimersByTime(SCAN_POLL_INTERVAL_MS * 5); });
    expect(client.getScan).toHaveBeenCalledTimes(1);
  });

  it('cancels the active scan', async () => {
    client.getScans.mockResolvedValue([scan({ id: 9, status: 'Requested' })]);
    client.cancelScan.mockResolvedValue(scan({ id: 9, status: 'Failed', error: 'Cancelled by an admin.' }));

    render(<MinecraftCatalogAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel scan' }));

    expect(await screen.findByText('Cancelled by an admin.')).toBeInTheDocument();
    expect(client.cancelScan).toHaveBeenCalledWith(9);
    expect(screen.queryByRole('button', { name: 'Cancel scan' })).not.toBeInTheDocument();
  });

  it('shows the API message when a scan is already active (409)', async () => {
    const conflict = Object.assign(new Error('A catalogue scan is already active (#5).'), {
      status: 409, response: 'A catalogue scan is already active (#5).',
    });
    client.requestScan.mockRejectedValue(conflict);

    render(<MinecraftCatalogAdminPage />);
    await screen.findByText(/No scan yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Scan server' }));

    expect(await screen.findByText('A catalogue scan is already active (#5).')).toBeInTheDocument();
    // The page reloads the scans to show the one that is running.
    await waitFor(() => expect(client.getScans).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('MinecraftCatalogAdminPage - needs attention', () => {
  it('merges a missing material into a picked target after confirmation, then reloads the audit', async () => {
    client.getAudit.mockResolvedValueOnce(emptyAudit({ missingButReferenced: [grassPath], readyForConstraints: false }));
    materials.searchPaged.mockResolvedValue({
      items: [
        { id: 40, namespaceKey: 'minecraft:grass_path', category: 'BLOCK' },
        { id: 41, namespaceKey: 'minecraft:dirt_path', category: 'BLOCK', displayName: 'Dirt Path', catalogStatus: 'Active' },
      ],
      totalCount: 2, page: 1, pageSize: 10, totalPages: 1,
    });
    client.mergeMaterial.mockResolvedValue({ sourceId: 40, targetId: 41, repointed: { 'ItemBlueprint.IconMaterialRefId': 2, 'Category.IconMaterialRefId': 1 } });

    render(<MinecraftCatalogAdminPage />);
    const table = await screen.findByRole('table', { name: 'Missing but referenced materials' });
    expect(within(table).getByText(/ItemBlueprint\.IconMaterialRefId × 2/)).toBeInTheDocument();

    fireEvent.click(within(table).getByRole('button', { name: 'Merge minecraft:grass_path into another material' }));
    const dialog = await screen.findByRole('dialog', { name: /Merge minecraft:grass_path into/ });
    // The search starts from the material's own name, and the source itself is never offered.
    await waitFor(() => expect(materials.searchPaged).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: 'grass_path' })));
    const targets = await within(dialog).findByRole('list', { name: 'Merge targets' });
    await waitFor(() => expect(within(targets).getAllByRole('button')).toHaveLength(1));
    fireEvent.click(within(targets).getByRole('button', { name: /Dirt Path/ }));

    const confirmDialog = await screen.findByRole('dialog', { name: 'Merge this material?' });
    expect(confirmDialog).toHaveTextContent('minecraft:grass_path (#40) into minecraft:dirt_path (#41)');
    expect(client.mergeMaterial).not.toHaveBeenCalled();
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(client.mergeMaterial).toHaveBeenCalledWith(40, 41));
    expect(await screen.findByText(/3 references repointed/)).toBeInTheDocument();
    await waitFor(() => expect(client.getAudit).toHaveBeenCalledTimes(2));
  });

  it('does not merge when the confirmation is cancelled', async () => {
    const kept = material({ id: 1, namespaceKey: 'minecraft:stone', totalReferences: 4, references: { 'Kit.IconMaterialRefId': 4 } });
    const duplicate = material({ id: 2, namespaceKey: 'STONE', normalizedKey: 'minecraft:stone', totalReferences: 1, references: { 'Kit.IconMaterialRefId': 1 } });
    client.getAudit.mockResolvedValue(emptyAudit({ materialKeyCollisions: [[duplicate, kept]] }));

    render(<MinecraftCatalogAdminPage />);
    const group = await screen.findByRole('group', { name: 'Collision minecraft:stone' });
    // The row already in normal form is kept by default; only the other one offers a merge.
    expect(within(group).getByRole('radio', { name: 'Keep minecraft:stone (#1)' })).toBeChecked();
    fireEvent.click(within(group).getByRole('button', { name: 'Merge STONE (#2) into minecraft:stone (#1)' }));

    const confirmDialog = await screen.findByRole('dialog', { name: 'Merge this material?' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Merge this material?' })).not.toBeInTheDocument());
    expect(client.mergeMaterial).not.toHaveBeenCalled();
  });

  it('merges a key collision into the row chosen to keep', async () => {
    const kept = material({ id: 1, namespaceKey: 'minecraft:stone' });
    const duplicate = material({ id: 2, namespaceKey: 'STONE', normalizedKey: 'minecraft:stone' });
    client.getAudit.mockResolvedValue(emptyAudit({ materialKeyCollisions: [[kept, duplicate]] }));
    client.mergeMaterial.mockResolvedValue({ sourceId: 1, targetId: 2, repointed: {} });

    render(<MinecraftCatalogAdminPage />);
    const group = await screen.findByRole('group', { name: 'Collision minecraft:stone' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Keep STONE (#2)' }));
    fireEvent.click(within(group).getByRole('button', { name: 'Merge minecraft:stone (#1) into STONE (#2)' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Merge this material?' })).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(client.mergeMaterial).toHaveBeenCalledWith(1, 2));
  });

  it('runs the backfill and shows what it changed', async () => {
    client.runBackfill.mockResolvedValue({
      materialKeysNormalized: 3, materialDisplayNamesFilled: 5, materialsCreated: 0, blockRefsCanonicalized: 2, blockRefsLinked: 1,
      skipped: ['Material #9 STONE: normal form minecraft:stone is taken'],
    });

    render(<MinecraftCatalogAdminPage />);
    expect(await screen.findByText('Nothing needs attention.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run backfill' }));

    expect(await screen.findByText(/Backfill done: 3 keys normalised/)).toBeInTheDocument();
    expect(screen.getByText('1 row skipped')).toBeInTheDocument();
    await waitFor(() => expect(client.getAudit).toHaveBeenCalledTimes(2));
  });

  it('lists block ref problems read-only', async () => {
    client.getAudit.mockResolvedValue(emptyAudit({
      readyForConstraints: false,
      unlinkedBlockRefs: [{ id: 5, namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=north]', materialRefId: null, stateKey: null }],
    }));

    render(<MinecraftCatalogAdminPage />);
    const table = await screen.findByRole('table', { name: 'Block refs without a material' });
    expect(within(table).getByText('minecraft:oak_stairs[facing=north]')).toBeInTheDocument();
    expect(within(table).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('MinecraftCatalogAdminPage - missing icons', () => {
  it('saves an icon override with a preview, then reloads the audit', async () => {
    const torch = material({ id: 60, namespaceKey: 'minecraft:wall_torch', displayName: 'Wall Torch', iconUrl: null });
    client.getAudit.mockResolvedValue(emptyAudit({ missingIcons: [torch] }));
    client.setIconOverride.mockResolvedValue(undefined);

    render(<MinecraftCatalogAdminPage />);
    const input = await screen.findByLabelText('Icon URL for minecraft:wall_torch');
    const table = screen.getByRole('table', { name: 'Materials without an icon' });
    expect(within(table).getByTestId('minecraft-icon-placeholder')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'https://example.org/torch.png' } });
    expect(within(table).getByRole('img', { name: 'Wall Torch' })).toHaveAttribute('src', 'https://example.org/torch.png');
    fireEvent.click(within(table).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.setIconOverride).toHaveBeenCalledWith(60, 'https://example.org/torch.png'));
    expect(await screen.findByText('Icon override of minecraft:wall_torch saved.')).toBeInTheDocument();
    await waitFor(() => expect(client.getAudit).toHaveBeenCalledTimes(2));
  });

  it('refuses a value that is not an http(s) URL', async () => {
    client.getAudit.mockResolvedValue(emptyAudit({ missingIcons: [material({ id: 60, namespaceKey: 'minecraft:wall_torch' })] }));

    render(<MinecraftCatalogAdminPage />);
    fireEvent.change(await screen.findByLabelText('Icon URL for minecraft:wall_torch'), { target: { value: 'torch.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Enter an http\(s\) URL/)).toBeInTheDocument();
    expect(client.setIconOverride).not.toHaveBeenCalled();
  });
});
