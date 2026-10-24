import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Pages that are the linking step themselves; the banner would only point at where the player is. */
const HIDDEN_ON = ['/account/link', '/link'];

/**
 * KNG-214: a logged-in player whose web account has no Minecraft account yet (UserDto.minecraftLinked
 * false, e.g. right after an invitation sign-up) is reminded on every page that the game needs that step.
 * An API without the field (undefined) shows nothing.
 */
export const UnlinkedBanner: React.FC = () => {
  const { isLoggedIn, user } = useAuth();
  const { pathname } = useLocation();
  if (!isLoggedIn || !user || user.minecraftLinked !== false || HIDDEN_ON.includes(pathname)) {
    return null;
  }
  return (
    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Link to="/account/link" className="font-medium underline">
        Link your Minecraft account to play →
      </Link>
    </div>
  );
};

export default UnlinkedBanner;
