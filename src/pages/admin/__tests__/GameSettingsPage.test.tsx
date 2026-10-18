import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
