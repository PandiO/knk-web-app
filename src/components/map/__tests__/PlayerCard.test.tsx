import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MapPlayerPanel, PlayerCard } from '../PlayerCard';
import type { MapPlayerDto } from '../../../types/dtos/map/MapDtos';

// PandiO/knk-workspace#739, § 4.4: the name card shows the label in its colours and the tags, nothing else.
const player = (over: Partial<MapPlayerDto> = {}): MapPlayerDto => ({
  uuid: 'u1', world: 'world', x: 1, y: 64, z: 2, yaw: 0, afk: false, mode: null, minigame: null,
  label: { rankTag: 'STAFF', braced: 'Knight', bracedBold: true, name: 'Mod', bracketColor: '&3', textColor: '&9' },
  ...over,
});

it('shows the label as the in-game chat line, coloured', () => {
  render(<PlayerCard player={player()} />);
  const line = screen.getByLabelText('Name label');
  expect(line).toHaveTextContent('[STAFF]-{Knight}- Mod');
  expect(within(line).getByText('Knight')).toHaveStyle({ color: '#5555FF', fontWeight: 700 });
  expect(within(line).getByText('-{')).toHaveStyle({ color: '#00AAAA' });
  expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
});

it('lists the tags', () => {
  render(<PlayerCard player={player({ mode: 'staff', afk: true })} />);
  expect(within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('listitem').map(item => item.textContent))
    .toEqual(['Staff mode', 'AFK']);
});

it('the panel shows no position and says when the player has left the map', () => {
  const { rerender } = render(<MapPlayerPanel player={player()} onClose={() => undefined} />);
  const panel = screen.getByRole('complementary', { name: 'Player details' });
  expect(within(panel).getByRole('heading', { name: 'Mod' })).toBeInTheDocument();
  expect(panel).not.toHaveTextContent('64');
  rerender(<MapPlayerPanel player={null} onClose={() => undefined} />);
  expect(screen.getByText('This player is no longer on the map.')).toBeInTheDocument();
});
