import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { createMapActionRegistry } from '../mapActionRegistry';
import { MapPanel } from '../MapPanel';
import { structureEntityType, WORLD_READ_NODE } from '../staffDetailsRegistrations';

// PandiO/knk-workspace#740 (A17, § 5 rule 10, O16): the staff "Details" widget is mounted only for a viewer holding the
// type's read node; nobody else loads it, so nobody else asks for a display configuration. The compact renderer itself
// is covered by DisplayWizard.compact.test.tsx; here it is a stand-in that records what it was asked to show.
const mockStatuses: Record<string, string> = {};
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermissions: (nodes: readonly string[]) =>
    Object.fromEntries(nodes.map(node => [node, mockStatuses[node] ?? 'unauthenticated'])),
}));

const mockShown: Array<{ entityType: string; id: number }> = [];
jest.mock('../widgets/StaffDetailsWidget', () => ({
  __esModule: true,
  default: (props: { entityType: string; id: number }) => {
    mockShown.push(props);
    return <section aria-label="Details">Details of {props.entityType} {props.id}</section>;
  },
}));

jest.mock('../../../apiClients/mapClient', () => ({
  mapClient: { getTown: jest.fn(), getDistrict: jest.fn(), getStructure: jest.fn() },
}));
// eslint-disable-next-line import/first
import { mapClient } from '../../../apiClients/mapClient';

const bakery = {
  id: 10, name: 'Bakery', description: '', type: 'Structure', subtype: null, districtName: 'Old Market', townName: 'Aldmoor',
  streetName: null, houseNumber: 0, gate: null,
};
const northGate = { ...bakery, id: 9, name: 'North Gate', subtype: 'Gate', gate: { underSiege: false, doors: [] } };

function renderPanel(kind: 'town' | 'district' | 'structure', id: number) {
  return render(
    <MapPanel registry={createMapActionRegistry()} selection={{ kind, id }} regionShown={false} canShowRegion
      onRegionShownChange={jest.fn()} onClose={jest.fn()} />,
  );
}

beforeEach(() => {
  Object.keys(mockStatuses).forEach(key => delete mockStatuses[key]);
  mockShown.length = 0;
  jest.clearAllMocks();
  (mapClient.getStructure as jest.Mock).mockImplementation(async (id: number) => (id === 9 ? northGate : bakery));
  (mapClient.getTown as jest.Mock).mockResolvedValue({ id: 1, name: 'Aldmoor', description: '', districtCount: 2 });
  (mapClient.getDistrict as jest.Mock).mockResolvedValue({ id: 4, name: 'Harbour', description: '', townName: 'Aldmoor' });
});

describe('staff details in the map panel (#740)', () => {
  it('shows "Details" under the public part for a viewer with knk.admin.world (A17)', async () => {
    mockStatuses[WORLD_READ_NODE] = 'allowed';
    renderPanel('structure', 10);
    const staff = await screen.findByRole('region', { name: 'Staff details' });
    expect(await screen.findByText('Details of Structure 10')).toBeInTheDocument();
    expect(staff).toContainElement(screen.getByRole('region', { name: 'Details' }));
  });

  it.each(['denied', 'unauthenticated', 'checking', 'error'])('mounts nothing for a viewer whose node is %s (A17)', async status => {
    mockStatuses[WORLD_READ_NODE] = status;
    renderPanel('structure', 10);
    expect(await screen.findByRole('heading', { name: 'Bakery' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Staff details' })).not.toBeInTheDocument();
    expect(mockShown).toHaveLength(0);
  });

  it('uses the gate\'s own type for a gate, and Town / District for those panels', async () => {
    mockStatuses[WORLD_READ_NODE] = 'allowed';
    const { unmount } = renderPanel('structure', 9);
    expect(await screen.findByText('Details of GateStructure 9')).toBeInTheDocument();
    unmount();
    const town = renderPanel('town', 1);
    expect(await screen.findByText('Details of Town 1')).toBeInTheDocument();
    town.unmount();
    renderPanel('district', 4);
    expect(await screen.findByText('Details of District 4')).toBeInTheDocument();
    await waitFor(() => expect(mockShown.map(p => p.entityType)).toEqual(expect.arrayContaining(['GateStructure', 'Town', 'District'])));
  });

  it('maps a structure panel to its display type', () => {
    expect(structureEntityType({ gate: null })).toBe('Structure');
    expect(structureEntityType({ gate: { underSiege: false, doors: [] } })).toBe('GateStructure');
  });
});
