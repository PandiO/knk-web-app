import React from 'react';
import { render } from '@testing-library/react';
import { usePublicSurface } from '../surface';

function PublicPage() {
  usePublicSurface();
  return <h1>Leaderboards</h1>;
}

// #95 / #92 (2026-11-03): the decorative heading font is for player-facing pages only; index.css keys it
// off data-surface="public" on <html>, which these pages set while they are shown.
describe('usePublicSurface', () => {
  it('marks <html> while a player-facing page is shown, and clears it after', () => {
    const { unmount } = render(<PublicPage />);
    expect(document.documentElement.getAttribute('data-surface')).toBe('public');
    unmount();
    expect(document.documentElement.hasAttribute('data-surface')).toBe(false);
  });
});
