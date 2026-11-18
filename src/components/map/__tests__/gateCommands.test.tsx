import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMapActionRegistry } from '../mapActionRegistry';
import { MapPanel } from '../MapPanel';
import { resetMapAvailability } from '../useMapAvailability';
import {
  describeGateCommandError,
  describeGateCommandResult,
  GATE_ADMIN_NODE,
  SIEGE_HINT,
} from '../widgets/GateCommandsWidget';

// PandiO/knk-workspace#742 (§ 4 item 6, § 5 rules 11 and 13, O14, O17; A18 page side, A22): gate command buttons are a
// staff widget in the map action registry, shown for a gate only to a knk.gate.admin holder while
// config.gateCommands.enabled is on; they send POST api/GateStructures/{id}/commands, show the result and read the
// panel again; during a siege match they are disabled with "Gate is in a running siege".
const mockStatuses: Record<string, string> = {};
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermissions: (nodes: readonly string[]) =>
    Object.fromEntries(nodes.map(node => [node, mockStatuses[node] ?? 'unauthenticated'])),
  usePermission: (node: string) => {
    const status = mockStatuses[node] ?? 'unauthenticated';
    return { allowed: status === 'allowed', isChecking: status === 'checking', status };
  },
}));

jest.mock('../widgets/StaffDetailsWidget', () => ({
  __esModule: true,
  default: () => <section aria-label="Details">Details</section>,
}));

jest.mock('../../../apiClients/mapClient', () => ({
  mapClient: { getConfig: jest.fn(), getTown: jest.fn(), getDistrict: jest.fn(), getStructure: jest.fn() },
}));
jest.mock('../../../apiClients/gateDoorClient', () => ({ gateDoorClient: { getByStructureId: jest.fn() } }));
jest.mock('../../../apiClients/gateCommandClient', () => ({ gateCommandClient: { send: jest.fn() } }));
/* eslint-disable import/first */
import { mapClient } from '../../../apiClients/mapClient';
import { gateDoorClient } from '../../../apiClients/gateDoorClient';
import { gateCommandClient } from '../../../apiClients/gateCommandClient';
/* eslint-enable import/first */

const config = (gateCommands: boolean) => ({
  enabled: true, markerVersion: 'v1', labels: { town: null, district: 1500, structure: 600, arena: 1500 },
  flash: { count: 3, durationMs: 400 }, livePlayers: { enabled: false, pollIntervalMs: 2000 },
  gateCommands: { enabled: gateCommands },
});

const northGate = (underSiege = false) => ({
  id: 9, name: 'North Gate', description: '', type: 'Structure', subtype: 'Gate', districtName: 'Harbour',
  townName: 'Aldmoor', streetName: 'Gate Road', houseNumber: 1,
  gate: {
    underSiege,
    doors: [{ name: 'Left door', openState: 'closed', isDestroyed: false, healthCurrent: 100, healthMax: 100 }],
  },
});
const bakery = { ...northGate(), id: 10, name: 'Bakery', subtype: null, gate: null };

const doors = [
  { id: 31, gateStructureId: 9, name: 'Left door', openedState: 'CLOSED', isDestroyed: false },
  { id: 32, gateStructureId: 9, name: 'Right door', openedState: 'OPEN', isDestroyed: true },
];

function renderPanel(id = 9) {
  return render(
    <MapPanel registry={createMapActionRegistry()} selection={{ kind: 'structure', id }} regionShown={false}
      canShowRegion={false} onRegionShownChange={jest.fn()} onClose={jest.fn()} />,
  );
}

const commands = () => screen.findByRole('region', { name: 'Gate commands' });

beforeEach(() => {
  Object.keys(mockStatuses).forEach(key => delete mockStatuses[key]);
  jest.clearAllMocks();
  resetMapAvailability();
  (mapClient.getConfig as jest.Mock).mockResolvedValue(config(true));
  (mapClient.getStructure as jest.Mock).mockImplementation(async (id: number) => (id === 9 ? northGate() : bakery));
  (gateDoorClient.getByStructureId as jest.Mock).mockResolvedValue(doors);
});

describe('who sees the gate command buttons', () => {
  it('a knk.gate.admin holder sees Open, Close, Toggle and Repair for the whole gate and per door (A18)', async () => {
    mockStatuses[GATE_ADMIN_NODE] = 'allowed';
    renderPanel();
    const section = await commands();
    for (const label of ['Open', 'Close', 'Toggle', 'Repair']) {
      expect(within(section).getByRole('button', { name: `${label} whole gate` })).toBeEnabled();
    }
    const left = await within(section).findByRole('listitem', { name: 'Left door' });
    expect(within(left).getByText('Closed', { selector: 'span' })).toBeInTheDocument();
    expect(within(left).getAllByRole('button').map(b => b.getAttribute('aria-label')))
      .toEqual(['Open Left door', 'Close Left door', 'Toggle Left door', 'Repair Left door']);
    const right = within(section).getByRole('listitem', { name: 'Right door' });
    expect(within(right).getByText('Destroyed')).toBeInTheDocument();
    expect(within(right).getByText('Open', { selector: 'span' })).toBeInTheDocument();
    expect(gateDoorClient.getByStructureId).toHaveBeenCalledWith(9);
    // The public part is unchanged next to it.
    expect(screen.getByRole('region', { name: 'Gate doors' })).toBeInTheDocument();
  });

  it('is hidden without the node, for anonymous viewers, for a structure that is not a gate and with the flag off', async () => {
    mockStatuses[GATE_ADMIN_NODE] = 'denied';
    let view = renderPanel();
    expect(await screen.findByRole('region', { name: 'Gate doors' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Gate commands' })).toBeNull();
    view.unmount();

    delete mockStatuses[GATE_ADMIN_NODE];
    view = renderPanel();
    expect(await screen.findByRole('region', { name: 'Gate doors' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Gate commands' })).toBeNull();
    view.unmount();

    mockStatuses[GATE_ADMIN_NODE] = 'allowed';
    view = renderPanel(10);
    expect(await screen.findByRole('heading', { name: 'Bakery' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Gate commands' })).toBeNull();
    view.unmount();

    resetMapAvailability();
    (mapClient.getConfig as jest.Mock).mockResolvedValue(config(false));
    renderPanel();
    expect(await screen.findByRole('region', { name: 'Gate doors' })).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('region', { name: 'Gate commands' })).toBeNull();
    expect(gateDoorClient.getByStructureId).not.toHaveBeenCalled();
    expect(gateCommandClient.send).not.toHaveBeenCalled();
  });
});

describe('sending a command', () => {
  beforeEach(() => { mockStatuses[GATE_ADMIN_NODE] = 'allowed'; });

  it('sends a door command with its doorId, shows the result and reads the panel and the doors again', async () => {
    (gateCommandClient.send as jest.Mock).mockResolvedValue({
      commandId: 'c1', gateId: 9, doorId: 31, action: 'open', result: 'done', message: 'Left door is opening.',
      doors: [{ doorId: 31, state: 'opening', healthCurrent: 100, healthMax: 100, destroyed: false, outcome: 'ok', reason: null }],
    });
    renderPanel();
    const section = await commands();
    fireEvent.click(await within(section).findByRole('button', { name: 'Open Left door' }));
    expect(await within(section).findByRole('status')).toHaveTextContent('Done: Left door is opening.');
    expect(gateCommandClient.send).toHaveBeenCalledWith(9, { action: 'open', doorId: 31 });
    await waitFor(() => expect(mapClient.getStructure).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(gateDoorClient.getByStructureId).toHaveBeenCalledTimes(2));
    // The panel keeps its widgets while it reads again, so the result stays on screen.
    expect(within(section).getByRole('status')).toHaveTextContent('Done: Left door is opening.');
  });

  it('sends a whole-gate command without a doorId and shows a refusal with its reason', async () => {
    (gateCommandClient.send as jest.Mock).mockResolvedValue({
      commandId: 'c2', gateId: 9, doorId: null, action: 'repair', result: 'refused', message: 'Nothing to repair.', doors: [],
    });
    renderPanel();
    fireEvent.click(within(await commands()).getByRole('button', { name: 'Repair whole gate' }));
    expect(await screen.findByText('Refused: Nothing to repair.')).toBeInTheDocument();
    expect(gateCommandClient.send).toHaveBeenCalledWith(9, { action: 'repair' });
  });

  it('disables every button with "Gate is in a running siege" while the public panel says under siege', async () => {
    (mapClient.getStructure as jest.Mock).mockResolvedValue(northGate(true));
    renderPanel();
    const section = await commands();
    expect(within(section).getByText(SIEGE_HINT)).toBeInTheDocument();
    await within(section).findByRole('listitem', { name: 'Left door' });
    const buttons = within(section).getAllByRole('button');
    expect(buttons).toHaveLength(12);
    buttons.forEach(button => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', SIEGE_HINT);
    });
  });

  it('a 409 from the API disables the buttons with the siege text too', async () => {
    (gateCommandClient.send as jest.Mock).mockRejectedValue(Object.assign(new Error('The gate is in a running siege match.'), { status: 409, code: 'GateInSiege' }));
    renderPanel();
    const section = await commands();
    fireEvent.click(within(section).getByRole('button', { name: 'Toggle whole gate' }));
    expect(await within(section).findByRole('status')).toHaveTextContent(SIEGE_HINT);
    expect(within(section).getByRole('button', { name: 'Open whole gate' })).toBeDisabled();
  });

  it('shows "no game server" and the time-out from the API', async () => {
    (gateCommandClient.send as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('No game server is connected.'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('The game server did not answer: timed out after 5 s.'), { status: 504 }));
    renderPanel();
    const section = await commands();
    fireEvent.click(within(section).getByRole('button', { name: 'Close whole gate' }));
    expect(await within(section).findByRole('status')).toHaveTextContent('No game server is connected.');
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Close whole gate' })).toBeEnabled());
    fireEvent.click(within(section).getByRole('button', { name: 'Close whole gate' }));
    expect(await within(section).findByText('The game server did not answer: timed out after 5 s.')).toBeInTheDocument();
  });
});

describe('result texts', () => {
  it('describes results and errors (§ 5 rule 11)', () => {
    expect(describeGateCommandResult({ commandId: '', gateId: 9, doorId: null, action: 'open', result: 'done', message: null, doors: [] }).text).toBe('Done.');
    expect(describeGateCommandResult({ commandId: '', gateId: 9, doorId: null, action: 'open', result: 'refused', message: null, doors: [] }).tone).toBe('warning');
    expect(describeGateCommandError({ status: 409, message: 'x' })).toEqual({ tone: 'error', text: SIEGE_HINT, siege: true });
    expect(describeGateCommandError({ status: 504, message: 'HTTP 504: Gateway Timeout' }).text).toBe('The game server did not answer: timed out after 5 s.');
    expect(describeGateCommandError({ status: 503 }).text).toBe('No game server is connected.');
    expect(describeGateCommandError({ status: 403 }).text).toBe('Requires knk.gate.admin');
    expect(describeGateCommandError(new Error('promise timeout')).text).toBe('The command could not be sent.');
  });
});
