import React from 'react';
import { UnlinkedBanner } from '../components/UnlinkedBanner';

/**
 * The page area under the fixed bar, shared by the layouts: `wide` for the admin console (sidebar + page).
 */
export const PageFrame: React.FC<{ wide?: boolean; children: React.ReactNode }> = ({ wide = false, children }) => (
  <div className="pt-16 p-8">
    <div className={`${wide ? 'max-w-screen-2xl' : 'max-w-7xl'} mx-auto space-y-12`}>
      <UnlinkedBanner />
      {children}
    </div>
  </div>
);
