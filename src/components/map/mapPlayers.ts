import {
  deserializeLegacyText,
  translateAlternateColorCodes,
} from '../admin/gameSettings/MinecraftLegacyPreview';
import type { MapPlayerDto, MapPlayerLabelDto } from '../../types/dtos/map/MapDtos';
import type { BridgePlayer, BridgePlayerTag, BridgeTextPart } from './bridgeProtocol';

/**
 * Live players for the map (PandiO/knk-workspace#739; OVERVIEW_MAP_DESIGN § 4.1, 4.4, 4.7, § 5 rules 6–9, O07, O23).
 * Turns `GET api/Map/players` into the bridge's `setPlayers` payload and the name card's label. Engine-neutral: no
 * BlueMap types here, the bridge script draws it.
 */

type Style = Omit<BridgeTextPart, 'text'>;

/**
 * The style of a group's `&` codes (`&6`, `&e&l`, hex `&x&f&f&a&a&0&0`), read the way the plugin's `LegacyStyles`
 * does: the last colour wins and resets the formats, formats after it add up. No colour: null (the label's default).
 */
export function styleOfCodes(codes: string | null | undefined): Style {
  if (!codes) return { color: null };
  // A marker character after the codes: its segment carries the codes' final style.
  const segments = deserializeLegacyText(`${translateAlternateColorCodes('&', codes)}\u0001`);
  const last = segments[segments.length - 1]?.style ?? {};
  const style: Style = { color: last.color ?? null };
  if (last.bold) style.bold = true;
  if (last.italic) style.italic = true;
  if (last.underline) style.underline = true;
  if (last.strikethrough) style.strikethrough = true;
  return style;
}

/**
 * The name label as the in-game chat line (O23, knk-plugin `ChatLineFormat`): `[OWNER]-{Title}- Name`. Brackets in the
 * bracket colour; rank tag, braced text and name in the text colour; the braced text bold for owner and staff.
 */
export function labelParts(label: MapPlayerLabelDto): BridgeTextPart[] {
  const bracket = styleOfCodes(label.bracketColor);
  const text = styleOfCodes(label.textColor);
  const parts: BridgeTextPart[] = [];
  if (label.rankTag) {
    parts.push({ text: '[', ...bracket }, { text: label.rankTag, ...text }, { text: ']', ...bracket });
  }
  if (label.braced) {
    parts.push(
      { text: '-{', ...bracket },
      { text: label.braced, ...text, ...(label.bracedBold ? { bold: true } : {}) },
      { text: '}-', ...bracket },
    );
  }
  const prefix = parts.length > 0 ? ' ' : '';
  parts.push({ text: `${prefix}${label.name}`, ...text });
  return parts;
}

export const plainLabel = (label: MapPlayerLabelDto): string => labelParts(label).map(part => part.text).join('');

const MODE_TAGS: Record<string, BridgePlayerTag> = {
  staff: { kind: 'staff', text: 'Staff mode' },
  owner: { kind: 'owner', text: 'Owner mode' },
};

/**
 * The tags of a player (O07, § 5 rules 7–9): the mode (only staff viewers ever receive one; an unknown mode reads
 * "Hidden mode"), the minigame (also staff viewers only) and AFK.
 */
export function playerTags(player: Pick<MapPlayerDto, 'afk' | 'mode' | 'minigame'>): BridgePlayerTag[] {
  const tags: BridgePlayerTag[] = [];
  if (player.mode) tags.push(MODE_TAGS[player.mode] ?? { kind: 'hidden', text: 'Hidden mode' });
  if (player.minigame) tags.push({ kind: 'minigame', text: player.minigame });
  if (player.afk) tags.push({ kind: 'afk', text: 'AFK' });
  return tags;
}

export function toBridgePlayer(player: MapPlayerDto): BridgePlayer {
  const parts = labelParts(player.label);
  return {
    uuid: player.uuid,
    label: parts.map(part => part.text).join(''),
    world: player.world,
    x: player.x,
    y: player.y,
    z: player.z,
    parts,
    tags: playerTags(player),
  };
}

export const toBridgePlayers = (players: MapPlayerDto[]): BridgePlayer[] => players.map(toBridgePlayer);

/** CSS for one label part (the name card uses the same parts as the map). */
export function partStyle(part: Style): { color?: string; fontWeight?: number; fontStyle?: string; textDecoration?: string } {
  const decoration = [part.underline ? 'underline' : '', part.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ');
  return {
    ...(part.color ? { color: part.color } : {}),
    ...(part.bold ? { fontWeight: 700 } : {}),
    ...(part.italic ? { fontStyle: 'italic' } : {}),
    ...(decoration ? { textDecoration: decoration } : {}),
  };
}
