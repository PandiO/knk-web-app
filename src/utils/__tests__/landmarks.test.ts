import { landmarkAreaLabel, landmarkDomainLabel, landmarkPointLabel } from '../landmarks';
import { getColumnDefinitions } from '../../config/objectConfigs';

describe('landmark display helpers (PandiO/knk-workspace#708)', () => {
  it('names the area', () => {
    expect(landmarkAreaLabel({ extentKind: 'None' })).toBe('Point');
    expect(landmarkAreaLabel({ extentKind: 'Region' })).toBe('Region');
    expect(landmarkAreaLabel({ extentKind: 'Radius', radius: 12 })).toBe('Radius 12 blocks');
    expect(landmarkAreaLabel({ extentKind: 'Radius', radius: 7.25 })).toBe('Radius 7.3 blocks');
    expect(landmarkAreaLabel({ extentKind: 'Radius' })).toBe('Radius');
  });

  it('rounds the point to whole blocks, or a dash without one', () => {
    expect(landmarkPointLabel({ x: 10.6, y: 64, z: -3.2 })).toBe('11 64 -3');
    expect(landmarkPointLabel({ x: null, y: 1, z: 2 })).toBe('—');
  });

  it('shows the domain with its type', () => {
    expect(landmarkDomainLabel({ domainName: 'Keep', domainType: 'Structure' })).toBe('Keep (Structure)');
    expect(landmarkDomainLabel({ domainName: 'Keep' })).toBe('Keep');
    expect(landmarkDomainLabel({ domainName: null })).toBe('—');
  });

  it('gives the dashboard table its landmark columns', () => {
    expect(getColumnDefinitions('Landmark').map(c => c.label))
      .toEqual(['ID', 'Name', 'World', 'Point', 'Domain', 'Area', 'In /navigate']);
  });
});
