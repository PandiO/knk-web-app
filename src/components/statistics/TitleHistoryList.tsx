import React from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { statisticsClient } from '../../apiClients/statisticsClient';
import { formatStatisticsDate, StatisticsPagedResultDto, TitleChangeDto } from '../../types/dtos/statistics/StatisticsDtos';

// A player's title history (KNG-34, D9: every title change comes from XP), newest first, paged.
// The API answers 403 when the player keeps it private (setting title_history) - shown as a note.

export const TITLE_HISTORY_PAGE_SIZE = 10;

export const TitleHistoryList: React.FC<{ userId: number; ownerLabel?: string }> = ({ userId, ownerLabel }) => {
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<StatisticsPagedResultDto<TitleChangeDto> | null>(null);
  const [hidden, setHidden] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    statisticsClient.getTitleHistory(userId, page, TITLE_HISTORY_PAGE_SIZE)
      .then(r => { if (!cancelled) { setResult(r); setHidden(false); } })
      .catch(err => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 403 || status === 401) {
          setHidden(true);
        } else {
          console.error('Failed to load the title history:', err);
          setError('Could not load the title history.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, page]);

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </div>
    );
  }
  if (hidden) {
    return <p className="text-sm text-gray-500">{ownerLabel ?? 'This player'} keeps the title history private.</p>;
  }
  if (error || !result) {
    return <p className="text-sm text-red-600">{error ?? 'Could not load the title history.'}</p>;
  }
  if (result.items.length === 0) {
    return <p className="text-sm text-gray-500">No title changes yet.</p>;
  }

  const pageCount = Math.max(1, Math.ceil(result.totalCount / TITLE_HISTORY_PAGE_SIZE));
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-gray-100" aria-label="Title history">
        {result.items.map((change, index) => (
          <li key={`${change.changedAt}-${index}`} className="py-2 flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              {change.direction === 'Promotion'
                ? <ArrowUpRight className="h-4 w-4 text-green-600" aria-label="Promotion" />
                : <ArrowDownRight className="h-4 w-4 text-red-600" aria-label="Demotion" />}
              <span className="text-gray-900">
                {change.fromTitleName ? <>{change.fromTitleName} → </> : null}
                <span className="font-medium">{change.toTitleName}</span>
              </span>
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatStatisticsDate(change.changedAt)}</span>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className="px-2 py-1 border rounded disabled:opacity-50" disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}>Previous</button>
          <span className="text-gray-600">Page {page} of {pageCount}</span>
          <button type="button" className="px-2 py-1 border rounded disabled:opacity-50" disabled={page >= pageCount}
            onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
};
