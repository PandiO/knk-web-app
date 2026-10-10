import React from 'react';
import { BarChart3, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatisticsOverview } from '../../components/statistics/StatisticsOverview';
import { StatisticsVisibilitySettings } from '../../components/statistics/StatisticsVisibilitySettings';
import { TitleHistoryList } from '../../components/statistics/TitleHistoryList';

// The player's own statistics on the account page (KNG-34, IMPLEMENTATION_PLAN.md §8 link 5):
// period tabs with per-group values and bars, the title history, and who may see what (the web
// twin of /stats settings). Shown when the account is linked to Minecraft - statistics are
// gathered in-game.

export const MyStatisticsSection: React.FC<{ userId: number; username?: string }> = ({ userId, username }) => {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <div className="border-b pb-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Statistics
        </h2>
        <span className="text-sm text-gray-500">
          {username && <><Link className="text-primary hover:underline" to={`/players/${encodeURIComponent(username)}`}>Public profile</Link> &middot; </>}
          <Link className="text-primary hover:underline" to="/leaderboards">Leaderboards</Link>
        </span>
      </div>

      <StatisticsOverview userId={userId} />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Title history</h3>
        <TitleHistoryList userId={userId} ownerLabel="You" />
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showSettings}
          onClick={() => setShowSettings(s => !s)}
          className="flex items-center text-sm font-semibold text-gray-700"
        >
          {showSettings ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
          <Shield className="h-4 w-4 mr-1" />
          Who may see my statistics
        </button>
        {showSettings && (
          <div className="mt-3">
            <StatisticsVisibilitySettings userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
};
