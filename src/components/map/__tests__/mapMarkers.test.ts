import type { MapMarkersDto } from '../../../types/dtos/map/MapDtos';
import { toBridgeMarkers, toBridgeOutline, townRegionKeys } from '../mapMarkers';

// PandiO/knk-workspace#737: pins with labels and label distances (O04, O19), outlines through the block centres.
const outline = (points: [number, number][]) => ({ world: 'world', points, minY: 60, maxY: 90 });

const markers: MapMarkersDto = {
  version: 'v1',
  towns: [
    { id: 1, name: 'Aldmoor', pin: { world: 'world', x: 10.5, y: 70, z: 20.5, source: 'location' }, outlines: [outline([[0, 0], [9, 0], [9, 9]])] },
    { id: 2, name: 'Bare', pin: { world: 'world', x: 500, y: 64, z: 500, source: 'location' }, outlines: [] },
  ],
  districts: [
    { id: 4, townId: 1, name: 'Harbour', pin: { world: 'world', x: 3.5, y: null, z: 3.5, source: 'centroid' }, outlines: [outline([[0, 0], [4, 0], [4, 4]])] },
    { id: 5, townId: 2, name: 'Elsewhere', pin: { world: 'world', x: 600, y: null, z: 600, source: 'centroid' }, outlines: [outline([[1, 1], [2, 1], [2, 2]])] },
  ],
  structures: [
    {
      id: 9, districtId: 4, townId: 1, name: 'North Gate', type: 'Structure', subtype: 'Gate', typeLabel: 'Structure, Gate',
      pin: { world: 'world', x: 1, y: 65, z: 2, source: 'location' }, outlines: [],
    },
  ],
};
const labels = { town: null, district: 1500, structure: 600, arena: 1500 };

describe('toBridgeMarkers', () => {
  const result = toBridgeMarkers(markers, labels);

  it('gives every town, district and structure a pin labelled with its name and the configured distance', () => {
    expect(result.version).toBe('v1');
    expect(result.pins.map(p => [p.kind, p.id, p.label, p.maxDistance])).toEqual([
      ['town', 1, 'Aldmoor', null],
      ['town', 2, 'Bare', null],
      ['district', 4, 'Harbour', 1500],
      ['district', 5, 'Elsewhere', 1500],
      ['structure', 9, 'North Gate', 600],
    ]);
  });

  it('labels a structure with its type and subtype (O06) and keeps a centroid pin without height', () => {
    expect(result.pins.find(p => p.kind === 'structure')?.sublabel).toBe('Structure, Gate');
    expect(result.pins.find(p => p.kind === 'district' && p.id === 4)?.y).toBeNull();
  });

  it('adds a region only for entities with outlines, keyed kind:id, shifted to block centres', () => {
    expect(result.regions.map(r => r.key)).toEqual(['town:1', 'district:4', 'district:5']);
    expect(result.regions[0].outlines[0].points).toEqual([[0.5, 0.5], [9.5, 0.5], [9.5, 9.5]]);
    expect(result.regions[0].label).toBe('Aldmoor');
  });
});

describe('toBridgeOutline', () => {
  it('adds 0.5 to x and z and keeps the height range', () => {
    expect(toBridgeOutline(outline([[-3, 7]]))).toEqual({ points: [[-2.5, 7.5]], minY: 60, maxY: 90 });
  });
});

describe('townRegionKeys', () => {
  it('lists the town and only its own districts (O05)', () => {
    expect(townRegionKeys(markers, 1)).toEqual(['town:1', 'district:4']);
    expect(townRegionKeys(markers, 2)).toEqual(['town:2', 'district:5']);
  });
});
