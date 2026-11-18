import type { MapPlayerDto, MapPlayerLabelDto } from '../../../types/dtos/map/MapDtos';
import { labelParts, partStyle, plainLabel, playerTags, styleOfCodes, toBridgePlayer } from '../mapPlayers';
import { toArenaPins, toBridgeMarkers } from '../mapMarkers';

// PandiO/knk-workspace#739: name labels as the in-game chat line (O23, A15), tags (O07, A12, A13), arena pins (A14).
const label = (over: Partial<MapPlayerLabelDto> = {}): MapPlayerLabelDto => ({
  rankTag: null, braced: null, bracedBold: false, name: 'Joe', bracketColor: '&2', textColor: '&a', ...over,
});

const player = (over: Partial<MapPlayerDto> = {}): MapPlayerDto => ({
  uuid: '0f2c8a3e-1111-4222-8333-444455556666', world: 'world', x: 10.5, y: 64, z: -3.2, yaw: 90,
  label: label(), afk: false, mode: null, minigame: null, ...over,
});

describe('styleOfCodes', () => {
  it('reads a colour, a colour with formats and a hex colour like LegacyStyles', () => {
    expect(styleOfCodes('&6')).toEqual({ color: '#FFAA00' });
    expect(styleOfCodes('&e&l')).toEqual({ color: '#FFFF55', bold: true });
    expect(styleOfCodes('&x&f&f&a&a&0&0')).toEqual({ color: '#FFAA00' });
    expect(styleOfCodes('&o&n&m&d')).toEqual({ color: '#FF55FF' });
    expect(styleOfCodes('&d&o&n&m')).toEqual({ color: '#FF55FF', italic: true, underline: true, strikethrough: true });
  });

  it('gives no colour for nothing or no colour code', () => {
    expect(styleOfCodes('')).toEqual({ color: null });
    expect(styleOfCodes(null)).toEqual({ color: null });
    expect(styleOfCodes('&l')).toEqual({ color: null, bold: true });
  });
});

describe('labelParts (A15)', () => {
  it('owner: [OWNER]-{Title}- Name, brackets gold, text dark purple, title bold', () => {
    const parts = labelParts(label({
      rankTag: 'OWNER', braced: 'King', bracedBold: true, name: 'Pandi', bracketColor: '&6', textColor: '&5',
    }));
    expect(parts).toEqual([
      { text: '[', color: '#FFAA00' },
      { text: 'OWNER', color: '#AA00AA' },
      { text: ']', color: '#FFAA00' },
      { text: '-{', color: '#FFAA00' },
      { text: 'King', color: '#AA00AA', bold: true },
      { text: '}-', color: '#FFAA00' },
      { text: ' Pandi', color: '#AA00AA' },
    ]);
    expect(plainLabel(label({ rankTag: 'OWNER', braced: 'King', name: 'Pandi' }))).toBe('[OWNER]-{King}- Pandi');
  });

  it('staff with a group colour that is bold itself', () => {
    const parts = labelParts(label({
      rankTag: 'STAFF', braced: 'Knight', bracedBold: true, name: 'Mod', bracketColor: '&3', textColor: '&e&l',
    }));
    expect(parts.map(part => part.text).join('')).toBe('[STAFF]-{Knight}- Mod');
    expect(parts[1]).toEqual({ text: 'STAFF', color: '#FFFF55', bold: true });
    expect(parts[6]).toEqual({ text: ' Mod', color: '#FFFF55', bold: true });
  });

  it('premium member: tier and title in the braces, group colours, nothing bold', () => {
    const parts = labelParts(label({ braced: 'Noble Squire', name: 'Rich', bracketColor: '&5', textColor: '&d' }));
    expect(parts).toEqual([
      { text: '-{', color: '#AA00AA' },
      { text: 'Noble Squire', color: '#FF55FF' },
      { text: '}-', color: '#AA00AA' },
      { text: ' Rich', color: '#FF55FF' },
    ]);
  });

  it('default player without a title: the name only, in the default green', () => {
    expect(labelParts(label())).toEqual([{ text: 'Joe', color: '#55FF55' }]);
  });
});

describe('playerTags', () => {
  it('has no tags for a plain player', () => {
    expect(playerTags(player())).toEqual([]);
  });

  it('tags staff mode, owner mode, an unknown mode, a minigame and AFK (A12, A13)', () => {
    expect(playerTags(player({ mode: 'staff', afk: true }))).toEqual([
      { kind: 'staff', text: 'Staff mode' }, { kind: 'afk', text: 'AFK' },
    ]);
    expect(playerTags(player({ mode: 'owner' }))).toEqual([{ kind: 'owner', text: 'Owner mode' }]);
    expect(playerTags(player({ mode: 'hidden' }))).toEqual([{ kind: 'hidden', text: 'Hidden mode' }]);
    expect(playerTags(player({ minigame: 'Siege' }))).toEqual([{ kind: 'minigame', text: 'Siege' }]);
  });
});

describe('toBridgePlayer', () => {
  it('keeps the v1 fields (plain label) and adds parts and tags', () => {
    const result = toBridgePlayer(player({ afk: true, label: label({ braced: 'Squire' }) }));
    expect(result).toEqual({
      uuid: '0f2c8a3e-1111-4222-8333-444455556666', label: '-{Squire}- Joe', world: 'world', x: 10.5, y: 64, z: -3.2,
      parts: labelParts(label({ braced: 'Squire' })), tags: [{ kind: 'afk', text: 'AFK' }],
    });
  });
});

describe('partStyle', () => {
  it('turns a part into CSS', () => {
    expect(partStyle({ color: '#FFAA00', bold: true, underline: true, strikethrough: true, italic: true })).toEqual({
      color: '#FFAA00', fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline line-through',
    });
    expect(partStyle({ color: null })).toEqual({});
  });
});

describe('arena pins (A14)', () => {
  const arena = {
    minigame: 'Siege', label: '[Siege] 12 players', playerCount: 12,
    pin: { world: 'world', x: 40, y: null, z: 50, source: 'centroid' },
  };

  it('one pin per running match with its label and the arena label distance', () => {
    expect(toArenaPins([arena], 1500)).toEqual([{
      kind: 'arena', id: 1, label: '[Siege] 12 players', sublabel: null, world: 'world', x: 40, y: null, z: 50, maxDistance: 1500,
    }]);
  });

  it('are added after the place pins, and none without arenas', () => {
    const markers = { version: 'v', towns: [], districts: [], structures: [] };
    const labels = { town: null, district: 1500, structure: 600, arena: null };
    expect(toBridgeMarkers(markers, labels).pins).toEqual([]);
    expect(toBridgeMarkers(markers, labels, [arena]).pins).toEqual([expect.objectContaining({ kind: 'arena', maxDistance: null })]);
  });
});
