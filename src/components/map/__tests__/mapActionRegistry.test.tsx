import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MapActionRegistry, createMapActionRegistry, MapPanelWidget } from '../mapActionRegistry';
import { MapPanel } from '../MapPanel';

// PandiO/knk-workspace#737, A22: a new action registered for a type shows in the panel under its node, with no change
// to the bridge script. Built-in kinds load their public panels from api/Map.
const mockStatuses: Record<string, string> = {};
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermissions: (nodes: readonly string[]) =>
    Object.fromEntries(nodes.map(node => [node, mockStatuses[node] ?? 'unauthenticated'])),
}));

jest.mock('../../../apiClients/mapClient', () => ({
  mapClient: {
    getTown: jest.fn(),
    getDistrict: jest.fn(),
    getStructure: jest.fn(),
  },
}));
// eslint-disable-next-line import/first
import { mapClient } from '../../../apiClients/mapClient';

type Thing = { id: number; name: string };

function thingRegistry(): MapActionRegistry {
  return new MapActionRegistry().register<Thing>({
    kind: 'structure',
    load: async id => ({ id, name: `Thing ${id}` }),
    title: data => data.name,
    publicWidgets: [{ id: 'info', Component: ({ data }) => <p>Public {data.name}</p> }],
    staffWidgets: [],
    actions: [],
  });
}

function renderPanel(registry: MapActionRegistry, kind: 'town' | 'district' | 'structure' = 'structure', id = 3) {
  return render(
    <MapPanel
      registry={registry}
      selection={{ kind, id }}
      regionShown={false}
      canShowRegion
      onRegionShownChange={jest.fn()}
      onClose={jest.fn()}
    />,
  );
}

beforeEach(() => {
  Object.keys(mockStatuses).forEach(key => delete mockStatuses[key]);
  jest.clearAllMocks();
});

describe('MapActionRegistry', () => {
  it('shows a newly registered action only to a viewer holding its node, and runs it with the data (A22)', async () => {
    const run = jest.fn();
    const registry = thingRegistry().addAction<Thing>('structure', { id: 'ping', label: 'Ping', node: 'knk.test.ping', run });

    mockStatuses['knk.test.ping'] = 'allowed';
    renderPanel(registry);
    fireEvent.click(await screen.findByRole('button', { name: 'Ping' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith({ id: 3, name: 'Thing 3' }, expect.objectContaining({ kind: 'structure', id: 3 })));
  });

  it('hides the action without the node and from anonymous viewers', async () => {
    const registry = thingRegistry().addAction<Thing>('structure', { id: 'ping', label: 'Ping', node: 'knk.test.ping', run: jest.fn() });

    mockStatuses['knk.test.ping'] = 'denied';
    const { unmount } = renderPanel(registry);
    expect(await screen.findByText('Public Thing 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ping' })).toBeNull();
    unmount();

    delete mockStatuses['knk.test.ping'];
    renderPanel(registry);
    expect(await screen.findByText('Public Thing 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ping' })).toBeNull();
  });

  it('shows a staff widget under its node, honours visible(), and replaces an entry with the same id', async () => {
    const widget: MapPanelWidget<Thing> = { id: 'secret', node: 'knk.admin.world', Component: () => <p>Staff part</p> };
    const registry = thingRegistry()
      .addWidget<Thing>('structure', 'staff', widget)
      .addAction<Thing>('structure', { id: 'a', label: 'Old label', node: null, run: jest.fn() })
      .addAction<Thing>('structure', { id: 'a', label: 'New label', node: null, run: jest.fn() })
      .addAction<Thing>('structure', { id: 'b', label: 'Never', node: null, visible: () => false, run: jest.fn() });
    mockStatuses['knk.admin.world'] = 'allowed';

    renderPanel(registry);
    expect(await screen.findByText('Staff part')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Staff details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New label' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Old label' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Never' })).toBeNull();
    expect(registry.nodesFor('structure')).toEqual(['knk.admin.world']);
  });

  it('refuses to add to a kind that is not registered', () => {
    expect(() => new MapActionRegistry().addAction('town', { id: 'x', label: 'X', node: null, run: jest.fn() })).toThrow(/town/);
  });
});

describe('the built-in registrations', () => {
  it('registers town, district and structure with no staff widgets or actions yet', () => {
    const registry = createMapActionRegistry();
    expect(registry.kinds().sort()).toEqual(['district', 'structure', 'town']);
    expect(registry.nodesFor('town')).toEqual([]);
  });

  it('shows the town panel with its public fields and the "Show region" switch', async () => {
    (mapClient.getTown as jest.Mock).mockResolvedValue({ id: 1, name: 'Aldmoor', description: 'A port town.', districtCount: 2 });
    const onRegionShownChange = jest.fn();
    render(
      <MapPanel registry={createMapActionRegistry()} selection={{ kind: 'town', id: 1 }} regionShown={false} canShowRegion
        onRegionShownChange={onRegionShownChange} onClose={jest.fn()} />,
    );
    expect(await screen.findByRole('heading', { name: 'Aldmoor' })).toBeInTheDocument();
    expect(screen.getByText('A port town.')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Show region' }));
    expect(onRegionShownChange).toHaveBeenCalledWith(true);
    expect(mapClient.getTown).toHaveBeenCalledWith(1);
  });

  it('says a place is gone on 404 and offers a retry on other errors', async () => {
    (mapClient.getDistrict as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('nf'), { status: 404 }));
    const { unmount } = renderPanel(createMapActionRegistry(), 'district', 4);
    expect(await screen.findByText('This place is no longer on the map.')).toBeInTheDocument();
    unmount();

    (mapClient.getDistrict as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
      .mockResolvedValueOnce({ id: 4, name: 'Harbour', description: '', townName: 'Aldmoor' });
    renderPanel(createMapActionRegistry(), 'district', 4);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Harbour' })).toBeInTheDocument();
    expect(screen.getByText('Aldmoor')).toBeInTheDocument();
  });
});
