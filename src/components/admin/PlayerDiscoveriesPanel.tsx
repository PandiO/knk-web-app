import React from 'react';
import { ChevronLeft, ChevronRight, Compass, Loader2, RotateCcw } from 'lucide-react';
import { discoveryClient } from '../../apiClients/discoveryClient';
import { usePermission } from '../../hooks/useStaffAccess';
import {
  DISCOVERY_ADMIN_NODE,
  DISCOVERY_DOMAIN_TYPES,
  DiscoveryPagedResultDto,
  DiscoveryProgressRowDto,
  DiscoverySummaryDto,
  discoveryTypeLabel,
  isDiscoveryTypeDisabled,
} from '../../types/dtos/discovery/DiscoveryDtos';
import { DiscoverySummaryBars, formatDiscoveryDate, formatDiscoveryRewards } from '../discovery/DiscoverySummaryBars';
import { FeedbackModal } from '../FeedbackModal';

// docs/specs/domain-discovery/DESIGN.md §3.9 - a player's discoveries on their moderation
// profile: per-type progress, the discovered places (newest first) with what each paid, and a
// reset per row. Only shown to holders of knk.admin.discovery; the API enforces the node as well
// and a 403 hides the panel. A reset doesn't take the reward back - it lets the place be
// discovered (and rewarded) again, and is written to the audit log as DiscoveryReset.

export const DISCOVERIES_PAGE_SIZE = 25;

export const PlayerDiscoveriesPanel: React.FC<{
  userId: number;
  /** Called after a successful reset, which added a DiscoveryReset audit entry. */
  onReset?: () => void;
}> = ({ userId, onReset }) => {
  const { allowed } = usePermission(DISCOVERY_ADMIN_NODE);

  const [forbidden, setForbidden] = React.useState(false);
  const [summary, setSummary] = React.useState<DiscoverySummaryDto | null>(null);
  // Types switched off in the Discovery settings: their places aren't discoverable or listed.
  const disabledTypes = React.useMemo(
    () => new Set((summary?.byType ?? []).filter(isDiscoveryTypeDisabled).map((type) => type.domainType)),
    [summary],
  );
  const [page, setPage] = React.useState<DiscoveryPagedResultDto<DiscoveryProgressRowDto> | null>(null);
  const [domainType, setDomainType] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resettingId, setResettingId] = React.useState<number | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);
  // The row whose Reset was clicked, awaiting confirmation in the modal.
  const [pendingReset, setPendingReset] = React.useState<DiscoveryProgressRowDto | null>(null);

  // Only the newest request may update the panel (fast paging/filter clicks).
  const requestSeq = React.useRef(0);

  const load = React.useCallback(async (pageNumber: number, type: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, pageResult] = await Promise.all([
        discoveryClient.getSummary(userId),
        discoveryClient.getProgress(userId, {
          pageNumber,
          pageSize: DISCOVERIES_PAGE_SIZE,
          filters: type ? { status: 'discovered', domainType: type } : { status: 'discovered' },
          sortBy: 'discoveredAt',
          sortDescending: true,
        }),
      ]);
      if (seq !== requestSeq.current) return;
      setSummary(summaryResult);
      setPage(pageResult);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if ((err as { status?: number } | null)?.status === 403) {
        setForbidden(true);
        return;
      }
      console.error('Failed to load discoveries:', err);
      setError('Could not load discoveries.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [userId]);

  // First page for a new player, permission or type filter.
  React.useEffect(() => {
    if (allowed) void load(1, domainType);
  }, [allowed, load, domainType]);

  if (!allowed || forbidden) return null;

  const pageNumber = page?.pageNumber ?? 1;
  const totalPages = page ? Math.max(1, Math.ceil(page.totalCount / DISCOVERIES_PAGE_SIZE)) : 1;

  const handleReset = async (row: DiscoveryProgressRowDto) => {
    setResettingId(row.domainId);
    setResetError(null);
    try {
      await discoveryClient.reset(userId, row.domainId);
      // Stay on this page unless it just became empty.
      const stayOn = page && page.items.length === 1 && pageNumber > 1 ? pageNumber - 1 : pageNumber;
      await load(stayOn, domainType);
      onReset?.();
    } catch (err) {
      console.error('Failed to reset discovery:', err);
      const status = (err as { status?: number } | null)?.status;
      const message = err instanceof Error ? err.message : null;
      setResetError(status !== undefined && status >= 400 && status < 500 && message ? message : 'Could not reset this discovery.');
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Compass className="h-5 w-5 mr-2" />
          Discoveries
        </h2>
        <select
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
          value={domainType}
          onChange={(e) => setDomainType(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {DISCOVERY_DOMAIN_TYPES.map((type) => (
            <option key={type} value={type}>
              {discoveryTypeLabel(type)}{disabledTypes.has(type) ? ' (disabled)' : ''}
            </option>
          ))}
        </select>
      </div>

      {summary && <div className="mb-4"><DiscoverySummaryBars summary={summary} showDisabled /></div>}

      {loading && !page ? (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !page || page.items.length === 0 ? (
        <p className="text-sm text-gray-500">
          {disabledTypes.has(domainType)
            ? 'This type is disabled in the Discovery settings, so its places are not listed.'
            : `No discoveries${domainType ? ' of this type' : ''} yet.`}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="py-2 pr-4">Place</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">In</th>
                  <th className="py-2 pr-4">Discovered</th>
                  <th className="py-2 pr-4">Rewards</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <tr key={row.domainId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-900">{row.name}</td>
                    <td className="py-2 pr-4 text-gray-700">{discoveryTypeLabel(row.domainType)}</td>
                    <td className="py-2 pr-4 text-gray-700">{row.parentName || '-'}</td>
                    <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{formatDiscoveryDate(row.discoveredAt)}</td>
                    <td className="py-2 pr-4 text-gray-700">{formatDiscoveryRewards(row)}</td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-red-700 hover:border-red-200 inline-flex items-center disabled:opacity-50"
                        disabled={resettingId !== null}
                        onClick={() => setPendingReset(row)}
                        title="Forget this discovery so it can be discovered again (the reward is not taken back)"
                      >
                        {resettingId === row.domainId
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-600">
              <button
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                disabled={loading || pageNumber <= 1}
                onClick={() => void load(pageNumber - 1, domainType)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Page {pageNumber} of {totalPages}</span>
              <button
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                disabled={loading || pageNumber >= totalPages}
                onClick={() => void load(pageNumber + 1, domainType)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
      {resetError && <p className="mt-3 text-xs text-red-600">{resetError}</p>}
      <FeedbackModal
        open={pendingReset !== null}
        title="Reset discovery?"
        message={`Reset the discovery of ${pendingReset?.name ?? ''}? The player keeps the reward they got and can discover (and be rewarded for) it again.`}
        continueLabel="Reset"
        onContinue={() => {
          if (pendingReset) void handleReset(pendingReset);
        }}
        onClose={() => setPendingReset(null)}
      />
    </div>
  );
};
