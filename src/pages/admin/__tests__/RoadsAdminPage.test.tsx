import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RoadsAdminPage, ROADS_WORLD_STORAGE_KEY } from '../RoadsAdminPage';
import { roadClient } from '../../../apiClients/roadClient';
import { streetClient } from '../../../apiClients/streetClient';
import { townClient } from '../../../apiClients/townClient';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { RoadEdgeDto, RoadNetworkMetaDto, RoadProfileDto, RoadTileDto } from '../../../types/dtos/road/RoadDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/roadClient', () => ({
  roadClient: {
    getProfiles: jest.fn(),
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteProfile: jest.fn(),
    getTiles: jest.fn(),
    getMeta: jest.fn(),
    searchEdges: jest.fn(),
    updateEdge: jest.fn(),
    getDomainNavigationDefaults: jest.fn(),
    updateDomainNavigationDefault: jest.fn(),
  },
}));
jest.mock('../../../apiClients/streetClient', () => ({
  streetClient: { searchPaged: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../apiClients/townClient', () => ({
  townClient: { searchPaged: jest.fn() },
}));
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({
  minecraftMaterialRefClient: { getHybrid: jest.fn() },
}));

const client = roadClient as jest.Mocked<typeof roadClient>;
const streets = streetClient as jest.Mocked<typeof streetClient>;
const towns = townClient as jest.Mocked<typeof townClient>;
const materials = minecraftMaterialRefClient as jest.Mocked<typeof minecraftMaterialRefClient>;

const defaultProfile: RoadProfileDto = {
  id: 1, name: 'Default road', roadClass: 'Road', costMultiplier: 1,
  materials: [
    { material: 'GRAVEL', role: 'Surface', ambiguous: false, centreShare: 0.6, edgeShare: 0.2, samples: 600 },
    { material: 'COBBLESTONE', role: 'Edge', ambiguous: true, centreShare: 0.1, edgeShare: 0.5, samples: 300 },
  ],
  widthMin: 2, widthMax: 7, sampleCount: 900, enabled: true, scopeTownIds: null, stats: {},
  createdAt: '2026-09-27T10:00:00Z', updatedAt: '2026-09-27T12:00:00Z',
};
const mainStreet: RoadProfileDto = {
  ...defaultProfile, id: 2, name: 'Kardenna main street', roadClass: 'Main', costMultiplier: 0.8, scopeTownIds: [4], enabled: false, sampleCount: 0, materials: [],
};

const tiles: RoadTileDto[] = [
  { id: 1, world: 'world', tileX: 0, tileZ: 0, version: 3, builtAt: '2026-09-27T20:00:00Z', builderVersion: 1, dirty: false, cellCount: 1200, nodeCount: 14, edgeCount: 16, levelCount: 1, warnings: [] },
  { id: 2, world: 'world', tileX: 1, tileZ: 0, version: 1, builtAt: '2026-09-27T20:05:00Z', builderVersion: 1, dirty: true, cellCount: 300, nodeCount: 4, edgeCount: 3, levelCount: 2, warnings: ['Cell cap hit near 700, 64, 120', 'Street label conflict on edge 42: Market Street / Harbour Road'] },
];

const meta: RoadNetworkMetaDto = {
  profiles: [defaultProfile, mainStreet],
  streets: [{ id: 5, name: 'Market Street' }],
  components: [{ id: 1, nodeCount: 18 }],
};

const edge = (overrides: Partial<RoadEdgeDto>): RoadEdgeDto => ({
  id: 10, fromNodeId: 1, toNodeId: 2, tileId: 1, world: 'world', geometry: [[0, 64, 100], [200, 64, 100]], length: 200.4,
  minX: 0, minY: 64, minZ: 100, maxX: 200, maxY: 64, maxZ: 100, avgWidth: 3.2, profileId: 1, streetId: 5, streetSource: 'Inferred',
  costMultiplier: 1, flags: [], gateDoorIds: [], domainIds: [], regionIds: [], source: 'Detected', status: 'Ok',
  ...overrides,
});

const EDGES = [
  edge({ id: 10 }),
  edge({ id: 11, streetId: null, streetSource: 'None', tileId: 2, status: 'Stale', flags: ['Closed'], costMultiplier: 2.5, profileId: null }),
];

const renderPage = () => render(<RoadsAdminPage />);

const edgeRow = (id: number) => screen.getAllByRole('row').find((r) => within(r).queryByText(`#${id}`))!;

describe('RoadsAdminPage', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.removeItem(ROADS_WORLD_STORAGE_KEY);
    client.getProfiles.mockResolvedValue([defaultProfile, mainStreet]);
    client.getTiles.mockResolvedValue(tiles);
    client.getMeta.mockResolvedValue(meta);
    client.searchEdges.mockResolvedValue({ items: EDGES, totalCount: 2, pageNumber: 1, pageSize: 25 });
    client.getDomainNavigationDefaults.mockResolvedValue([
      { domainType: 'Town', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
      { domainType: 'GateStructure', defaultMode: 'Region', overrideCount: 1, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
    ]);
    streets.searchPaged.mockResolvedValue({ items: [{ id: 5, name: 'Market Street' }, { id: 6, name: 'Harbour Road' }], totalCount: 2, page: 1, pageSize: 1000, totalPages: 1 });
    towns.searchPaged.mockResolvedValue({ items: [{ id: 4, name: 'Kardenna', allowEntry: true, requiredTitle: 0 }], totalCount: 1, page: 1, pageSize: 1000, totalPages: 1 });
    materials.getHybrid.mockResolvedValue([]);
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('loads the default world: profiles, tiles with their warnings and the stretches', async () => {
    renderPage();

    expect(await screen.findByText('Default road')).toBeInTheDocument();
    expect(client.getMeta).toHaveBeenCalledWith('world');
    expect(client.getTiles).toHaveBeenCalledWith('world');
    expect(client.searchEdges).toHaveBeenCalledWith({
      pageNumber: 1, pageSize: 25, sortBy: 'id', sortDescending: false, filters: { world: 'world' },
    });

    // Profiles
    const mainRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Kardenna main street'))!;
    expect(within(mainRow).getByText('Main')).toBeInTheDocument();
    expect(within(mainRow).getByText('1 town')).toBeInTheDocument();
    expect(within(mainRow).getByText('No')).toBeInTheDocument();

    // Tiles: the dirty one has two warnings, expandable
    const dirtyTile = screen.getAllByRole('row').find((r) => within(r).queryByText('1, 0'))!;
    expect(within(dirtyTile).getByText('Dirty')).toBeInTheDocument();
    expect(screen.queryByText(/Cell cap hit/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show warnings of tile 1, 0' }));
    expect(screen.getByText('Cell cap hit near 700, 64, 120')).toBeInTheDocument();

    // Navigation defaults per domain type (KNG-73)
    expect(await screen.findByLabelText('Gates navigation default')).toHaveValue('Region');

    // Edges: street name from the meta, tile coordinates from the tile list, a Rename link
    expect(await screen.findByText('#10')).toBeInTheDocument();
    const labelled = edgeRow(10);
    expect(within(labelled).getByText('Market Street')).toBeInTheDocument();
    expect(within(labelled).getByRole('link', { name: 'Rename' })).toHaveAttribute('href', '/forms/street/edit/5');
    expect(within(labelled).getByText('Default road (Road)')).toBeInTheDocument();
    const unlabelled = edgeRow(11);
    expect(within(unlabelled).getByText('unlabelled')).toBeInTheDocument();
    expect(within(unlabelled).getByText('1, 0')).toBeInTheDocument();
    expect(within(unlabelled).getByText('Closed')).toBeInTheDocument();
    expect(within(unlabelled).getByText('stale')).toBeInTheDocument();
    expect(screen.getByText('1 – 2 of 2 stretches')).toBeInTheDocument();
  });

  it('says so when the world cannot be loaded', async () => {
    client.getTiles.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText('Could not load the road network of world "world".')).toBeInTheDocument();
  });

  it('switches world and remembers it', async () => {
    renderPage();
    await screen.findByText('Default road');

    const input = screen.getByLabelText('World');
    await userEvent.clear(input);
    await userEvent.type(input, 'nether');
    await userEvent.click(screen.getByRole('button', { name: 'Switch world' }));

    await waitFor(() => expect(client.getTiles).toHaveBeenLastCalledWith('nether'));
    expect(window.localStorage.getItem(ROADS_WORLD_STORAGE_KEY)).toBe('nether');
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { world: 'nether' } })));
  });

  it('filters the stretches on the server', async () => {
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByLabelText('Unlabelled stretches only'));
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { world: 'world', unlabelled: 'true' } })));

    await userEvent.click(screen.getByLabelText('Stale stretches only'));
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { world: 'world', unlabelled: 'true', stale: 'true' } })));

    await userEvent.selectOptions(screen.getByLabelText('Street filter'), '5');
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { world: 'world', streetId: '5', unlabelled: 'true', stale: 'true' } })));

    await userEvent.click(screen.getByRole('button', { name: 'Show edges of tile 1, 0' }));
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ filters: expect.objectContaining({ tileId: '2' }) })));
    await userEvent.click(screen.getByRole('button', { name: 'Show every tile' }));
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { world: 'world', streetId: '5', unlabelled: 'true', stale: 'true' } })));
  });

  it('labels a stretch with a street, continuing along the road, and says how many followed', async () => {
    client.updateEdge.mockResolvedValue({ edge: edge({ id: 11, streetId: 6, streetSource: 'Manual' }), changedEdgeIds: [11, 12, 13] });
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 11' }));
    expect(streets.searchPaged).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 1000, sortBy: 'name' }));
    await userEvent.click(await screen.findByRole('button', { name: /Select Street/ }));
    await userEvent.click(screen.getByText('Harbour Road (6)'));
    expect(screen.getByLabelText('Continue along the road')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.updateEdge).toHaveBeenCalledWith(11, { streetId: 6, propagate: true }));
    expect(await screen.findByText('Stretch #11 saved; "Harbour Road" continued along the road onto 2 more stretches.')).toBeInTheDocument();
    // The table is searched again (propagated labels may be on this page) and the meta reloaded.
    expect(client.searchEdges).toHaveBeenCalledTimes(2);
    expect(client.getMeta).toHaveBeenCalledTimes(2);
  });

  it('saves cost, flags and a class override without touching the street, and cancels', async () => {
    client.updateEdge.mockResolvedValue({ edge: edge({ id: 10, costMultiplier: 1.5, flags: ['NoGps'], profileId: 2 }), changedEdgeIds: [10] });
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Stretch 10 cost multiplier')).not.toBeInTheDocument();
    expect(client.updateEdge).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 10' }));
    // Without a street change the propagate box is disabled.
    expect(screen.getByLabelText('Continue along the road')).toBeDisabled();
    const cost = screen.getByLabelText('Stretch 10 cost multiplier');
    await userEvent.clear(cost);
    await userEvent.type(cost, '1.5');
    await userEvent.click(screen.getByLabelText('Stretch 10 NoGps'));
    await userEvent.selectOptions(screen.getByLabelText('Stretch 10 profile'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.updateEdge).toHaveBeenCalledWith(10, { costMultiplier: 1.5, flags: ['NoGps'], profileId: 2 }));
    expect(await screen.findByText('Stretch #10 saved.')).toBeInTheDocument();
    expect(client.getMeta).toHaveBeenCalledTimes(1);
  });

  it('clears a street label', async () => {
    client.updateEdge.mockResolvedValue({ edge: edge({ id: 10, streetId: null, streetSource: 'None' }), changedEdgeIds: [10] });
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 10' }));
    // The picker shows the current street; its X clears it.
    const picker = await screen.findByText('Market Street (5)');
    await userEvent.click(within(picker.parentElement as HTMLElement).getByRole('button'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.updateEdge).toHaveBeenCalledWith(10, { clearStreet: true }));
  });

  it("shows the API's reason when a stretch is refused, and keeps editing", async () => {
    client.updateEdge.mockRejectedValue(Object.assign(new Error('Street 6 does not exist.'), { status: 400 }));
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 11' }));
    await userEvent.click(await screen.findByRole('button', { name: /Select Street/ }));
    await userEvent.click(screen.getByText('Harbour Road (6)'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Street 6 does not exist.')).toBeInTheDocument();
    expect(screen.getByLabelText('Stretch 11 cost multiplier')).toBeInTheDocument();
  });

  it('refuses a non-positive cost before calling the API', async () => {
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 10' }));
    const cost = screen.getByLabelText('Stretch 10 cost multiplier');
    await userEvent.clear(cost);
    await userEvent.type(cost, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Cost multiplier must be greater than 0.')).toBeInTheDocument();
    expect(client.updateEdge).not.toHaveBeenCalled();
  });

  it('creates a street from the picker and assigns it', async () => {
    streets.create.mockResolvedValue({ id: 9, name: 'Mill Lane' });
    client.updateEdge.mockResolvedValue({ edge: edge({ id: 11, streetId: 9, streetSource: 'Manual' }), changedEdgeIds: [11] });
    renderPage();
    await screen.findByText('#10');

    await userEvent.click(screen.getByRole('button', { name: 'Edit stretch 11' }));
    await userEvent.click(await screen.findByRole('button', { name: /Select Street/ }));
    await userEvent.click(screen.getByRole('button', { name: /Create New Street/ }));
    await userEvent.type(screen.getByLabelText('New street name'), 'Mill Lane');
    await userEvent.click(screen.getByRole('button', { name: 'Create street' }));

    await waitFor(() => expect(streets.create).toHaveBeenCalledWith({ name: 'Mill Lane' }));
    expect(await screen.findByText('Mill Lane (9)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.updateEdge).toHaveBeenCalledWith(11, { streetId: 9, propagate: true }));
  });

  it('pages through the stretches', async () => {
    client.searchEdges.mockResolvedValue({ items: EDGES, totalCount: 60, pageNumber: 1, pageSize: 25 });
    renderPage();
    await screen.findByText('#10');
    expect(screen.getByText('1 – 25 of 60 stretches')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 })));

    await userEvent.selectOptions(screen.getByLabelText('Stretches per page'), '100');
    await waitFor(() => expect(client.searchEdges).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, pageSize: 100 })));
  });

  describe('profiles', () => {
    it('creates a profile with a material and a scope town', async () => {
      client.createProfile.mockResolvedValue({ ...defaultProfile, id: 3, name: 'Trail' });
      materials.getHybrid.mockResolvedValue([
        { namespaceKey: 'minecraft:dirt_path', category: 'block', displayName: 'Dirt Path', isPersisted: false },
      ]);
      renderPage();
      await screen.findByText('Default road');

      await userEvent.click(screen.getByRole('button', { name: 'New profile' }));
      await userEvent.type(screen.getByLabelText('Profile name'), 'Trail');
      await userEvent.selectOptions(screen.getByLabelText('Profile class'), 'Path');

      // Scope: towns are loaded when the editor opens
      await userEvent.click(await screen.findByRole('button', { name: /Select Town/ }));
      await userEvent.click(screen.getByText('Kardenna (4)'));
      await userEvent.click(screen.getByRole('button', { name: 'Add town' }));
      expect(screen.getByRole('button', { name: 'Remove Kardenna from scope' })).toBeInTheDocument();

      // Materials: typed key with a catalogue suggestion
      await userEvent.click(screen.getByRole('button', { name: 'Add material' }));
      await userEvent.type(screen.getByLabelText('Material 1 material'), 'dirt');
      await waitFor(() => expect(materials.getHybrid).toHaveBeenCalledWith('dirt', undefined, 8));
      await userEvent.click(await screen.findByRole('option', { name: /DIRT_PATH/ }));
      await userEvent.selectOptions(screen.getByLabelText('DIRT_PATH role'), 'Surface');

      client.getProfiles.mockResolvedValue([defaultProfile, mainStreet, { ...defaultProfile, id: 3, name: 'Trail' }]);
      await userEvent.click(screen.getByRole('button', { name: 'Create profile' }));

      await waitFor(() => expect(client.createProfile).toHaveBeenCalledWith({
        name: 'Trail', roadClass: 'Path', costMultiplier: 1, widthMin: 1, widthMax: 15, sampleCount: 0, enabled: true,
        scopeTownIds: [4], stats: null,
        materials: [{ material: 'DIRT_PATH', role: 'Surface', ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 }],
      }));
      expect(await screen.findByText('Trail')).toBeInTheDocument();
      expect(screen.queryByTestId('road-profile-editor')).not.toBeInTheDocument();
    });

    it('edits a profile, keeping its statistics, and shows the API refusal', async () => {
      client.updateProfile.mockRejectedValue(Object.assign(new Error("A road profile named 'Default road' already exists."), { status: 400 }));
      renderPage();
      await screen.findByText('Default road');

      await userEvent.click(screen.getByRole('button', { name: 'Edit Kardenna main street profile' }));
      const name = screen.getByLabelText('Profile name');
      await userEvent.clear(name);
      await userEvent.type(name, 'Default road');
      await userEvent.click(screen.getByLabelText('Profile enabled'));
      await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

      await waitFor(() => expect(client.updateProfile).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Default road', enabled: true, scopeTownIds: [4], stats: null })));
      expect(await screen.findByText("A road profile named 'Default road' already exists.")).toBeInTheDocument();
    });

    it('refuses a bad width range before calling the API', async () => {
      renderPage();
      await screen.findByText('Default road');

      await userEvent.click(screen.getByRole('button', { name: 'Edit Default road profile' }));
      const max = screen.getByLabelText('Profile width max');
      await userEvent.clear(max);
      await userEvent.type(max, '1');
      await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

      expect(await screen.findByText('Width max (1) cannot be below width min (2).')).toBeInTheDocument();
      expect(client.updateProfile).not.toHaveBeenCalled();
    });

    it('deletes a profile after confirmation', async () => {
      client.deleteProfile.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText('Default road');

      client.getProfiles.mockResolvedValue([defaultProfile]);
      await userEvent.click(screen.getByRole('button', { name: 'Delete Kardenna main street profile' }));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Kardenna main street'));
      await waitFor(() => expect(client.deleteProfile).toHaveBeenCalledWith(2));
      await waitFor(() => expect(screen.queryByText('Kardenna main street')).not.toBeInTheDocument());
    });
  });
});
