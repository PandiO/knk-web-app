import React from 'react';
import { BarChart3 } from 'lucide-react';
import { statisticsClient } from '../../apiClients/statisticsClient';
import { usePermission } from '../../hooks/useStaffAccess';
import { STATISTICS_STAFF_NODE } from '../../types/dtos/statistics/StatisticsDtos';
import { StatisticsOverview } from '../statistics/StatisticsOverview';
import { StatisticsVisibilitySettings } from '../statistics/StatisticsVisibilitySettings';
import { TitleHistoryList } from '../statistics/TitleHistoryList';

// A player's statistics on their moderation profile (KNG-34, L1-20): everything the player has
// (staff see past the visibility settings), the title history and - read-only - who the player
// lets see what. Only shown to holders of knk.admin.statistics.view; the API enforces the node too
// (the visibility read answers 403 without it), and a 403 hides the panel.

export const PlayerStatisticsPanel: React.FC<{ userId: number }> = ({ userId }) => {
  const { allowed } = usePermission(STATISTICS_STAFF_NODE);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setForbidden(false);
    // The staff check of the API itself: a 403 here means the node isn't really granted.
    statisticsClient.getVisibility(userId).catch(err => {
      if (!cancelled && (err as { status?: number })?.status === 403) setForbidden(true);
    });
    return () => { cancelled = true; };
  }, [allowed, userId]);

  if (!allowed || forbidden) return null;

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <BarChart3 className="h-5 w-5 mr-2" />
        Statistics
      </h2>
      <StatisticsOverview userId={userId} />
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Title history</h3>
        <TitleHistoryList userId={userId} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Visibility settings (read-only)</h3>
        <StatisticsVisibilitySettings userId={userId} readOnly />
      </div>
    </div>
  );
};
