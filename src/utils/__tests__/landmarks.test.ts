import {
  domainTypeLabel,
  landmarkAreaLabel,
  landmarkParentLabel,
  landmarkPointLabel,
  landmarkRegionLabel,
  rowEntityType,
} from '../landmarks';
import { getColumnDefinitions } from '../../config/objectConfigs';

describe('landmark display helpers (PandiO/knk-workspace#708, landmark-domain #986)', () => {
  it('names the area kinds as the form does', () => {
    expect(landmarkAreaLabel({ areaKind: 'None' })).toBe('Point');
    expect(landmarkAreaLabel({ areaKind: 'OwnRegion' })).toBe('Own region');
    expect(landmarkAreaLabel({ areaKind: 'LinkedDomain' })).toBe("Linked domain's area");
    expect(landmarkAreaLabel({})).toBe('Point');
    expect(landmarkAreaLabel({ areaKind: 'Elsewhere' })).toBe('Elsewhere');
  });

  it('shows the own region only for an own-region landmark', () => {
    expect(landmarkRegionLabel({ areaKind: 'OwnRegion', wgRegionId: 'domain_12' })).toBe('domain_12');
    expect(landmarkRegionLabel({ areaKind: 'LinkedDomain', wgRegionId: null })).toBe('—');
    expect(landmarkRegionLabel({ areaKind: 'None' })).toBe('—');
  });

  it('rounds the point to whole blocks, or a dash without one', () => {
    expect(landmarkPointLabel({ x: 10.6, y: 64, z: -3.2 })).toBe('11 64 -3');
    expect(landmarkPointLabel({ x: null, y: 1, z: 2 })).toBe('—');
  });

  it('shows the parent with its type', () => {
    expect(landmarkParentLabel({ parentDomainName: 'Keep', parentDomainType: 'Structure' })).toBe('Keep (Structure)');
    expect(landmarkParentLabel({ parentDomainName: 'East gate', parentDomainType: 'GateStructure' })).toBe('East gate (Gate)');
    expect(landmarkParentLabel({ parentDomainName: 'Keep' })).toBe('Keep');
    expect(landmarkParentLabel({ parentDomainName: null })).toBe('—');
  });

  it('names the domain types', () => {
    expect(domainTypeLabel('Landmark')).toBe('Landmark');
    expect(domainTypeLabel('GateStructure')).toBe('Gate');
    expect(domainTypeLabel('CrownLand')).toBe('Crown land');
    expect(domainTypeLabel('ProductionStructure')).toBe('Production structure');
    expect(domainTypeLabel(undefined)).toBe('—');
  });

  it('gives the dashboard table its landmark columns', () => {
    expect(getColumnDefinitions('Landmark').map(c => c.label))
      .toEqual(['ID', 'Name', 'World', 'Point', 'Parent', 'Area', 'Region', 'In /navigate']);
  });

  it('gives domain lists and pickers a type column (A07, A18)', () => {
    const columns = getColumnDefinitions('Domain');
    expect(columns.map(c => c.label)).toEqual(['ID', 'Name', 'Type', 'World']);
    const type = columns.find(c => c.label === 'Type')!;
    expect(type.render!({ id: 3, name: 'Tower', domainType: 'Landmark' } as any)).toBe('Landmark');
  });

  it('opens a landmark row of the domain list as a landmark, and nothing else (DESIGN § 4.3)', () => {
    expect(rowEntityType('Domain', { domainType: 'Landmark' })).toBe('Landmark');
    expect(rowEntityType('domain', { domainType: 'Landmark' })).toBe('Landmark');
    expect(rowEntityType('Domain', { domainType: 'Town' })).toBe('Domain');
    expect(rowEntityType('Town', { domainType: 'Landmark' })).toBe('Town');
    expect(rowEntityType('Domain', null)).toBe('Domain');
  });
});
