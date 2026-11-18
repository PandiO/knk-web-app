import React from 'react';
import { render, screen, within } from '@testing-library/react';
import type { MapStructurePanelDto } from '../../../types/dtos/map/MapDtos';
import { doorStateLabel, GateDoorsWidget, healthPercent } from '../widgets/GateDoorsWidget';
import { structureAddress, structureTypeLabel } from '../widgets/StructureWidgets';
import type { MapPanelContext } from '../mapActionRegistry';

// PandiO/knk-workspace#737, A09: each door with open/closed, destroyed and a health bar.
const context: MapPanelContext = {
  kind: 'structure', id: 9, regionShown: false, canShowRegion: false, setRegionShown: jest.fn(), reload: jest.fn(),
  gateCommands: { enabled: false },
};

const gate: MapStructurePanelDto = {
  id: 9, name: 'North Gate', description: '', type: 'Structure', subtype: 'Gate', districtName: 'Harbour',
  townName: 'Aldmoor', streetName: 'Gate Road', houseNumber: 1,
  gate: {
    underSiege: true,
    doors: [
      { name: 'Left door', openState: 'open', isDestroyed: false, healthCurrent: 75, healthMax: 100 },
      { name: 'Right door', openState: 'closed', isDestroyed: true, healthCurrent: 0, healthMax: 100 },
    ],
  },
};

describe('GateDoorsWidget', () => {
  it('lists every door with its state, destroyed flag and health bar, and "Under siege"', () => {
    render(<GateDoorsWidget data={gate} context={context} />);
    expect(screen.getByText('Under siege')).toBeInTheDocument();
    const left = screen.getByRole('listitem', { name: 'Left door' });
    expect(within(left).getByText('Open')).toBeInTheDocument();
    expect(within(left).queryByText('Destroyed')).toBeNull();
    expect(within(left).getByRole('progressbar', { name: 'Left door health' })).toHaveAttribute('aria-valuenow', '75');
    const right = screen.getByRole('listitem', { name: 'Right door' });
    expect(within(right).getByText('Closed')).toBeInTheDocument();
    expect(within(right).getByText('Destroyed')).toBeInTheDocument();
    expect(within(right).getByRole('progressbar', { name: 'Right door health' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders nothing for a plain structure', () => {
    const { container } = render(<GateDoorsWidget data={{ ...gate, gate: null }} context={context} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels every lower-case door state and clamps the health percentage', () => {
    expect(['open', 'closed', 'opening', 'closing', 'jammed'].map(doorStateLabel))
      .toEqual(['Open', 'Closed', 'Opening', 'Closing', 'Jammed']);
    expect(healthPercent({ healthCurrent: 150, healthMax: 100 })).toBe(100);
    expect(healthPercent({ healthCurrent: 5, healthMax: 0 })).toBe(0);
  });
});

describe('structure fields', () => {
  it('joins type and subtype and builds the address', () => {
    expect(structureTypeLabel(gate)).toBe('Structure, Gate');
    expect(structureTypeLabel({ type: 'Structure', subtype: null })).toBe('Structure');
    expect(structureAddress(gate)).toBe('Gate Road 1');
    expect(structureAddress({ streetName: '', houseNumber: 3 })).toBeNull();
  });
});
