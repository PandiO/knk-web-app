import { entityDisplayLabel, entityTypeFallbackLabel, typeLabelFor } from '../entityLabel';

describe('entityDisplayLabel (#81)', () => {
  it('uses the first name-like field', () => {
    expect(entityDisplayLabel({ id: 4, name: 'Cinix' }, 4)).toBe('Cinix');
    expect(entityDisplayLabel({ id: 4, displayName: 'Sharpness', name: 'sharpness' }, 4)).toBe('Sharpness');
    expect(entityDisplayLabel({ id: 9, username: 'Pandi' })).toBe('Pandi');
    expect(entityDisplayLabel({ id: 9, name: '  ', key: 'north_gate' })).toBe('north_gate');
  });

  it('falls back to the id', () => {
    expect(entityDisplayLabel({ id: 4, worldName: 'world' }, 4)).toBe('#4');
    expect(entityDisplayLabel({ id: 7 })).toBe('#7');
    expect(entityDisplayLabel(null, '12')).toBe('#12');
    expect(entityDisplayLabel(null)).toBe('');
  });
});

describe('type labels', () => {
  it('reads the metadata display name, whatever the case, else splits the name', () => {
    const labelFor = typeLabelFor([{ entityName: 'GateStructure', displayName: 'Gate structure' }, { entityName: 'Kit', displayName: '' }]);
    expect(labelFor('gatestructure')).toBe('Gate structure');
    expect(labelFor('Kit')).toBe('Kit');
    expect(labelFor('SiegeLobby')).toBe('Siege Lobby');
    expect(entityTypeFallbackLabel('lootbox_type')).toBe('Lootbox type');
  });
});
