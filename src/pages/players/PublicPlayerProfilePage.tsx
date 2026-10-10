import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, UserCircle2 } from 'lucide-react';
import { playerClient } from '../../apiClients/playerClient';
import { StatisticsOverview } from '../../components/statistics/StatisticsOverview';
import { TitleHistoryList } from '../../components/statistics/TitleHistoryList';
import {
  formatDuration,
  formatStatisticsDate,
  PublicPlayerProfileDto,
} from '../../types/dtos/statistics/StatisticsDtos';

// A player's public profile (/players/:username, KNG-34, IMPLEMENTATION_PLAN.md §3.2): the
// always-public fields for anyone (signed in or not), then the statistics and title history the
// API shows to this viewer - other signed-in players see what the player set to Everyone. No
// online status (vanish must not leak).

export const PublicPlayerProfilePage: React.FC = () => {
  const { username = '' } = useParams<{ username: string }>();
  const [profile, setProfile] = React.useState<PublicPlayerProfileDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    playerClient.getByName(username)
      .then(result => { if (!cancelled) setProfile(result); })
      .catch(err => {
        if (cancelled) return;
        if ((err as { status?: number })?.status === 404) {
          setError(`No player named "${username}".`);
        } else {
          console.error('Failed to load the player profile:', err);
          setError('Could not load this player.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-2">
        <p className="text-red-600">{error ?? 'Could not load this player.'}</p>
        <Link to="/leaderboards" className="text-sm text-primary hover:underline">Back to the leaderboards</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-10 w-10 text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{profile.username}</h1>
            <p className="text-sm text-gray-600">{profile.titleName ?? 'No title yet'}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <Fact label="Experience" value={profile.experience.toLocaleString('en-US')} />
          <Fact label="Coins" value={profile.coins.toLocaleString('en-US')} />
          <Fact label="Gems" value={profile.gems.toLocaleString('en-US')} />
          <Fact label="Active playtime" value={formatDuration(profile.activePlaytimeSeconds)} />
          <Fact label="AFK time" value={formatDuration(profile.afkSeconds)} />
          <Fact label="First joined" value={formatStatisticsDate(profile.firstJoinedAt)} />
        </dl>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
        <StatisticsOverview userId={profile.userId} showProfile={false} />
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Title history</h2>
        <TitleHistoryList userId={profile.userId} ownerLabel={profile.username} />
      </div>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900">{value}</dd>
  </div>
);

export default PublicPlayerProfilePage;
