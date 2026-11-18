import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MODERATION_NODES, PlayerModerationPanel, playerProfilePath } from '../PlayerModerationPanel';
import type { MapPlayerDto } from '../../../types/dtos/map/MapDtos';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

// PandiO/knk-workspace#743 (OVERVIEW_MAP_DESIGN § 4.4, § 5 rule 12, O11, O25; A20, A21): the player context panel under
// the name card opens for a viewer holding any moderation node; each action shows only under its own node and uses
// the profile page's hooks and endpoints; "Open profile" goes to PlayerProfilePage. The account is read by UUID.
const mockStatuses: Record<string, string> = {};
jest.mock('../../../hooks/useStaffAccess', () => {
  const actual = jest.requireActual('../../../hooks/useStaffAccess');
  return {
    ...actual,
    usePermissions: (nodes: readonly string[]) =>
      Object.fromEntries(nodes.map(node => [node, mockStatuses[node] ?? 'unauthenticated'])),
    usePermission: (node: string) => {
      const status = mockStatuses[node] ?? 'unauthenticated';
      return { allowed: status === 'allowed', isChecking: status === 'checking', status, retry: jest.fn() };
    },
  };
});

jest.mock('../../../apiClients/userManagementClient', () => ({
  userManagementClient: {
    getByUuid: jest.fn(), freeze: jest.fn(), unfreeze: jest.fn(), kick: jest.fn(), ban: jest.fn(),
  },
}));
/* eslint-disable import/first */
import { userManagementClient } from '../../../apiClients/userManagementClient';
/* eslint-enable import/first */

const client = userManagementClient as unknown as Record<string, jest.Mock>;

const steve: MapPlayerDto = {
  uuid: '00000000-0000-4000-8000-0000000000f1', world: 'world', x: 1, y: 64, z: 2, yaw: 0, afk: false, mode: null,
  minigame: null,
  label: { rankTag: null, braced: null, bracedBold: false, name: 'Steve', bracketColor: '&2', textColor: '&a' },
};

const grant = (...nodes: string[]) => {
  MODERATION_NODES.forEach(node => { mockStatuses[node] = nodes.includes(node) ? 'allowed' : 'denied'; });
};

const renderPanel = () => render(<MemoryRouter><PlayerModerationPanel player={steve} /></MemoryRouter>);

beforeEach(() => {
  Object.keys(mockStatuses).forEach(key => delete mockStatuses[key]);
  jest.clearAllMocks();
  client.getByUuid.mockResolvedValue({ id: 7, username: 'Steve', uuid: steve.uuid, isFrozen: false, frozenReason: null });
  client.kick.mockResolvedValue({ queued: true });
  client.ban.mockResolvedValue({ queued: true });
  client.freeze.mockResolvedValue(undefined);
  client.unfreeze.mockResolvedValue(undefined);
});

it('opens for each of the five nodes (O25)', () => {
  expect([...MODERATION_NODES]).toEqual(['knk.freeze', 'knk.unfreeze', 'knk.kick', 'knk.ban', 'knk.admin.user.manage']);
});

it('anonymous: renders nothing and reads no account', () => {
  const { container } = renderPanel();
  expect(container).toBeEmptyDOMElement();
  expect(client.getByUuid).not.toHaveBeenCalled();
});

it('without any moderation node: nothing beyond the name card, no account read (A21)', () => {
  grant();
  const { container } = renderPanel();
  expect(container).toBeEmptyDOMElement();
  expect(client.getByUuid).not.toHaveBeenCalled();
});

it('renders nothing while the node checks run', () => {
  MODERATION_NODES.forEach(node => { mockStatuses[node] = 'checking'; });
  const { container } = renderPanel();
  expect(container).toBeEmptyDOMElement();
  expect(client.getByUuid).not.toHaveBeenCalled();
});

it('with only knk.kick: Kick and "Open profile", nothing else; kick sends the reason (A20)', async () => {
  grant('knk.kick');
  renderPanel();
  const link = await screen.findByRole('link', { name: 'Open profile' });
  expect(link).toHaveAttribute('href', playerProfilePath(7));
  expect(playerProfilePath(7)).toBe('/admin/users/7');
  expect(client.getByUuid).toHaveBeenCalledWith(steve.uuid);
  const actions = screen.getByRole('group', { name: 'Moderation actions' });
  expect(within(actions).getAllByRole('button').map(button => button.textContent)).toEqual(['Kick…']);

  fireEvent.click(within(actions).getByRole('button', { name: 'Kick…' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Kick Steve?' });
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'AFK farming' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Kick' }));
  await waitFor(() => expect(client.kick).toHaveBeenCalledWith(7, 'AFK farming'));
});

it('with every node: Freeze, Kick and Ban; ban asks a reason and posts it', async () => {
  grant(...MODERATION_NODES);
  renderPanel();
  const actions = await screen.findByRole('group', { name: 'Moderation actions' });
  expect(within(actions).getAllByRole('button').map(button => button.textContent)).toEqual(['Freeze…', 'Kick…', 'Ban…']);

  fireEvent.click(within(actions).getByRole('button', { name: 'Ban…' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Ban Steve permanently?' });
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'X-ray' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ban permanently' }));
  await waitFor(() => expect(client.ban).toHaveBeenCalledWith(7, 'X-ray'));
});

it('freeze posts the reason and reads the account again', async () => {
  grant('knk.freeze');
  renderPanel();
  fireEvent.click(await screen.findByRole('button', { name: 'Freeze…' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Freeze Steve?' });
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Griefing' } });
  client.getByUuid.mockResolvedValue({ id: 7, username: 'Steve', isFrozen: true, frozenReason: 'Griefing' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Freeze' }));
  await waitFor(() => expect(client.freeze).toHaveBeenCalledWith(7, 'Griefing'));
  // Frozen now; only knk.freeze held, so no Unfreeze button, but the state shows.
  expect(await screen.findByText(/Reason: Griefing/)).toBeInTheDocument();
  expect(client.getByUuid).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'Unfreeze' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Freeze…' })).not.toBeInTheDocument();
});

it('a frozen player shows the reason and Unfreeze for a knk.unfreeze holder', async () => {
  grant('knk.unfreeze');
  client.getByUuid.mockResolvedValue({ id: 7, username: 'Steve', isFrozen: true, frozenReason: 'Griefing' });
  renderPanel();
  expect(await screen.findByRole('button', { name: 'Unfreeze' })).toBeInTheDocument();
  expect(screen.getByText(/Reason: Griefing/)).toBeInTheDocument();
});

it('a knk.unfreeze holder sees no button for a player who is not frozen', async () => {
  grant('knk.unfreeze');
  renderPanel();
  const actions = await screen.findByRole('group', { name: 'Moderation actions' });
  expect(within(actions).queryAllByRole('button')).toHaveLength(0);
  expect(screen.queryByText(/Frozen\./)).not.toBeInTheDocument();
});

it('with only knk.admin.user.manage: "Open profile" and no action', async () => {
  grant('knk.admin.user.manage');
  renderPanel();
  expect(await screen.findByRole('link', { name: 'Open profile' })).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Moderation actions' })).queryAllByRole('button')).toHaveLength(0);
});

it('a player without a web account (404) says so and offers nothing', async () => {
  grant('knk.kick');
  client.getByUuid.mockRejectedValue({ status: 404 });
  renderPanel();
  expect(await screen.findByText('Steve has no account in the web app yet, so there is nothing to moderate here.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open profile' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('a failed account read shows an error', async () => {
  grant('knk.kick');
  client.getByUuid.mockRejectedValue({ status: 500 });
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('The player’s account could not be read.');
});
