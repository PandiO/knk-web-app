import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import { formatAmount } from '../../../utils/auditDetails';
import {
  DISCOVERY_DOMAIN_TYPES,
  DiscoveryStatsDto,
  discoveryTypeLabel,
} from '../../../types/dtos/discovery/DiscoveryDtos';

// docs/specs/domain-discovery/DESIGN.md §3.9 (4) - GET api/discoveries/stats: how many players
// found each enabled place (most or least discovered first), who was first, and the top explorers.

export const STATS_PAGE_SIZE = 25;

type Order = 'most' | 'least' | 'name';

const ORDER_QUERY: Record<Order, { sortBy: 'discoverers' | 'name'; sortDescending: boolean }> = {
  most: { sortBy: 'discoverers', sortDescending: true },
  least: { sortBy: 'discoverers', sortDescending: false },
  name: { sortBy: 'name', sortDescending: false },
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

export const DiscoveryStatsCard: React.FC = () => {
  const [domainType, setDomainType] = React.useState('');
  const [order, setOrder] = React.useState<Order>('most');
  const [pageNumber, setPageNumber] = React.useState(1);
  const [stats, setStats] = React.useState<DiscoveryStatsDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    discoveryClient.getStats({ pageNumber, pageSize: STATS_PAGE_SIZE, domainType: domainType || undefined, ...ORDER_QUERY[order] })
      .then((result) => { if (!cancelled) setStats(result); })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load discovery statistics:', err);
        setError('Could not load discovery statistics.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [domainType, order, pageNumber]);

  const domains = stats?.domains;
  const totalPages = domains ? Math.max(1, Math.ceil(domains.totalCount / STATS_PAGE_SIZE)) : 1;

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Statistics
          </h2>
          {stats && (
            <p className="text-sm text-gray-500">
              Percentages are of the {formatAmount(stats.linkedUserCount)} active players with a linked Minecraft account.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            value={domainType}
            onChange={(e) => { setDomainType(e.target.value); setPageNumber(1); }}
            aria-label="Statistics type"
          >
            <option value="">All types</option>
            {DISCOVERY_DOMAIN_TYPES.map((type) => <option key={type} value={type}>{discoveryTypeLabel(type)}</option>)}
          </select>
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            value={order}
            onChange={(e) => { setOrder(e.target.value as Order); setPageNumber(1); }}
            aria-label="Statistics order"
          >
            <option value="most">Most discovered first</option>
            <option value="least">Least discovered first</option>
            <option value="name">By name</option>
          </select>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : stats && domains ? (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            {domains.items.length === 0 ? (
              <p className="text-sm text-gray-500">No discoverable places.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="py-2 pr-4">Place</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">In</th>
                      <th className="py-2 pr-4">Discoverers</th>
                      <th className="py-2 pr-4">First discoverer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.items.map((stat) => (
                      <tr key={stat.domainId} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium text-gray-900">{stat.name}</td>
                        <td className="py-2 pr-4 text-gray-700">{discoveryTypeLabel(stat.domainType)}</td>
                        <td className="py-2 pr-4 text-gray-700">{stat.parentName || '-'}</td>
                        <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                          {formatAmount(stat.discoverers)}
                          <span className="text-gray-500"> ({Number(stat.discovererPercent.toFixed(1))}%)</span>
                        </td>
                        <td className="py-2 pr-4 text-gray-700">
                          {stat.firstDiscovererUserId ? (
                            <>
                              <Link to={`/admin/users/${stat.firstDiscovererUserId}`} className="text-primary hover:underline">
                                {stat.firstDiscovererUsername ?? `User #${stat.firstDiscovererUserId}`}
                              </Link>
                              <span className="text-xs text-gray-500"> on {formatDate(stat.firstDiscoveredAt)}</span>
                            </>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-600">
                <button
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                  disabled={loading || pageNumber <= 1}
                  onClick={() => setPageNumber(pageNumber - 1)}
                  aria-label="Previous statistics page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>Page {pageNumber} of {totalPages}</span>
                <button
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                  disabled={loading || pageNumber >= totalPages}
                  onClick={() => setPageNumber(pageNumber + 1)}
                  aria-label="Next statistics page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <Trophy className="h-4 w-4 mr-1.5 text-amber-500" />
              Top explorers
            </h3>
            {stats.topExplorers.length === 0 ? (
              <p className="text-sm text-gray-500">Nobody has discovered anything yet.</p>
            ) : (
              <ol className="space-y-1 text-sm">
                {stats.topExplorers.map((explorer, index) => (
                  <li key={explorer.userId} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-gray-400 mr-1.5">{index + 1}.</span>
                      <Link to={`/admin/users/${explorer.userId}`} className="text-primary hover:underline">
                        {explorer.username ?? `User #${explorer.userId}`}
                      </Link>
                    </span>
                    <span className="text-gray-700">{formatAmount(explorer.discoveries)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
