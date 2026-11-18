import React from 'react';
import { X } from 'lucide-react';
import type { MapPlayerDto } from '../../types/dtos/map/MapDtos';
import type { BridgePlayerTagKind } from './bridgeProtocol';
import { labelParts, partStyle, playerTags } from './mapPlayers';

const IN_GAME_STRIP: React.CSSProperties = { backgroundColor: 'rgba(0, 0, 0, 0.85)', color: '#FFFFFF' };

const TAG_CLASSES: Record<BridgePlayerTagKind, string> = {
  afk: 'bg-surface-alt text-muted',
  staff: 'bg-info-muted text-info-strong',
  owner: 'bg-warning-muted text-warning-strong',
  hidden: 'bg-surface-alt text-fg',
  minigame: 'bg-success-muted text-success-strong',
};

/**
 * The name card of a live player (OVERVIEW_MAP_DESIGN § 4.4, O07, O23; PandiO/knk-workspace#739): the label as the
 * in-game chat line, in its colours on a dark strip as in game, and the tags. Nothing else: no position, no account
 * data. Anonymous and ordinary viewers get only this card; the moderation panel (#743) comes below it.
 */
export const PlayerCard: React.FC<{ player: MapPlayerDto }> = ({ player }) => {
  const parts = labelParts(player.label);
  const tags = playerTags(player);
  return (
    <div className="space-y-2">
      {/* The in-game chat background: the group colours are made for it, whatever the site theme. */}
      <p aria-label="Name label" className="rounded-md px-2 py-1 font-semibold" style={IN_GAME_STRIP}>
        {parts.map((part, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={index} style={partStyle(part)}>{part.text}</span>
        ))}
      </p>
      {tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <li key={tag.kind} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_CLASSES[tag.kind]}`}>
              {tag.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface PanelProps {
  /** The player's latest snapshot entry, or null when they are no longer in the viewer's snapshot. */
  player: MapPlayerDto | null;
  onClose: () => void;
  /** Further sections below the name card (the moderation panel of #743 goes here). */
  children?: React.ReactNode;
}

/**
 * The side panel (a bottom sheet on a phone) for a clicked player (§ 4.4). It follows the live snapshot while open:
 * tags update with the next poll, and a player who left the viewer's snapshot reads "no longer on the map".
 */
export const MapPlayerPanel: React.FC<PanelProps> = ({ player, onClose, children }) => (
  <aside
    aria-label="Player details"
    className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-xl border border-line bg-surface p-4 shadow-xl
      md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-96 md:rounded-xl"
  >
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-fg">{player ? player.label.name : 'Not available'}</h2>
        {player && <p className="text-sm text-muted">Player</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="rounded-md p-1 text-muted hover:bg-surface-hover hover:text-fg focus:outline-none focus:ring-2 focus:ring-focus"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    {player ? (
      <div className="space-y-4">
        <PlayerCard player={player} />
        {children}
      </div>
    ) : (
      <p className="text-sm text-muted">This player is no longer on the map.</p>
    )}
  </aside>
);
