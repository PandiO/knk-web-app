import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { GameSettingsPage } from '../GameSettingsPage';
import { gameSettingsClient } from '../../../apiClients/gameSettingsClient';
import { locationClient } from '../../../apiClients/locationClient';
import { townClient } from '../../../apiClients/townClient';
import { districtClient } from '../../../apiClients/districtClient';
import { structureClient } from '../../../apiClients/structureClient';
import { permissionGroupClient } from '../../../apiClients/permissionGroupClient';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../../../apiClients/gameSettingsClient', () => ({ gameSettingsClient: { get: jest.fn(), update: jest.fn(), getHubDomains: jest.fn() } }));
jest.mock('../../../apiClients/locationClient', () => ({ locationClient: { getAll: jest.fn() } }));
jest.mock('../../../apiClients/townClient', () => ({ townClient: { getAll: jest.fn() } }));
jest.mock('../../../apiClients/districtClient', () => ({ districtClient: { getAll: jest.fn() } }));
jest.mock('../../../apiClients/structureClient', () => ({ structureClient: { getAll: jest.fn() } }));
jest.mock('../../../apiClients/permissionGroupClient', () => ({ permissionGroupClient: { getAll: jest.fn() } }));
jest.mock('../../../components/admin/DataRetentionCard', () => ({ DataRetentionCard: () => null }));

describe('GameSettingsPage load failure (SET-1)', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    // CRA resets mocks before each test, so the lookups the page loads alongside are set here.
    [locationClient, townClient, districtClient, structureClient, permissionGroupClient]
      .forEach(client => (client.getAll as jest.Mock).mockResolvedValue([]));
    (gameSettingsClient.getHubDomains as jest.Mock).mockResolvedValue([]);
  });
  afterEach(() => consoleError.mockRestore());

  it('shows an error with Retry and no saveable form', async () => {
    (gameSettingsClient.get as jest.Mock).mockRejectedValue(Object.assign(new Error('down'), { status: 503 }));

    render(<GameSettingsPage />);

    expect(await screen.findByText('Game settings could not be loaded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Settings/ })).not.toBeInTheDocument();
    expect(gameSettingsClient.update).not.toHaveBeenCalled();
  });

  it('Retry loads again', async () => {
    (gameSettingsClient.get as jest.Mock).mockRejectedValue(new Error('down'));
    render(<GameSettingsPage />);
    await screen.findByText('Game settings could not be loaded');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(gameSettingsClient.get).toHaveBeenCalledTimes(2));
  });
});

describe('GameSettingsPage on the SettingsPage shell (#187, SET-4)', () => {
  const LOADED = {
    id: 'global', settingsVersion: '1', joinAnnouncement: '&a{player} joined.', leaveAnnouncement: '&e{player} left.',
    joinSpawnMode: 'WorldSpawn', joinSpawnReference: null, defaultRespawnPolicy: null, worldSettings: [], runtimeWorlds: [],
    runtimeWorldsLastUpdatedAt: null, motd: null, groupOverrides: [], createdAt: '2026-10-01T10:00:00', updatedAt: '2026-11-05T20:52:02',
  };
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    [locationClient, townClient, districtClient, structureClient, permissionGroupClient]
      .forEach(client => (client.getAll as jest.Mock).mockResolvedValue([]));
    (gameSettingsClient.getHubDomains as jest.Mock).mockResolvedValue([]);
    (gameSettingsClient.get as jest.Mock).mockResolvedValue(LOADED);
    (gameSettingsClient.update as jest.Mock).mockImplementation(async (dto: object) => ({ ...LOADED, ...dto, updatedAt: '2026-11-05T21:00:00' }));
  });
  afterEach(() => consoleError.mockRestore());

  it('counts a change, saves it with a toast and is clean again', async () => {
    const { toast } = jest.requireActual('../../../utils/toast');
    const success = jest.spyOn(toast, 'success').mockImplementation(() => undefined);
    render(<GameSettingsPage />);
    const join = await screen.findByLabelText('Join Announcement');
    expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save/ })).toBeDisabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Game Manager Settings' })).toBeInTheDocument();

    await userEvent.type(join, '!');
    expect(screen.getByText('1 unsaved change.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save (1)' }));

    await waitFor(() => expect(gameSettingsClient.update).toHaveBeenCalledWith(expect.objectContaining({ joinAnnouncement: '&a{player} joined.!' })));
    await waitFor(() => expect(success).toHaveBeenCalledWith('Game settings saved.'));
    expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
    success.mockRestore();
  });

  it('Discard asks, then puts the saved values back', async () => {
    render(<GameSettingsPage />);
    const motd = await screen.findByLabelText('MOTD');
    await userEvent.type(motd, 'Hello');
    expect(screen.getByText('1 unsaved change.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Discard/ }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard 1 unsaved change?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.getByLabelText('MOTD')).toHaveValue(''));
    expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
  });

  it('keeps the changes and shows the API reason in the header when a save is refused', async () => {
    (gameSettingsClient.update as jest.Mock).mockRejectedValue(Object.assign(new Error('x'), { status: 400, response: { message: 'The hub spawn is in another world.' } }));
    render(<GameSettingsPage />);
    await userEvent.type(await screen.findByLabelText('Leave Announcement'), '?');
    await userEvent.click(screen.getByRole('button', { name: 'Save (1)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The hub spawn is in another world.');
    expect(screen.getByText('1 unsaved change.')).toBeInTheDocument();
  });
});
