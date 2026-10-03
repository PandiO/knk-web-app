import React, { useCallback, useEffect, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { worldAnalyticsClient } from '../../apiClients/worldAnalyticsClient';
import { OwnerOnlyNotice } from '../../components/OwnerRoute';
import { HeatmapCanvas } from '../../components/owner/HeatmapCanvas';
import {
  AnalyticsRange,
  DomainInteractionReportDto,
  HeatmapDto,
  HeatmapWorldDto,
  MenuFunnelDto,
  MenuFunnelReportDto,
  OWNER_ANALYTICS_VIEW_NODE,
} from '../../types/dtos/analytics/WorldAnalyticsDtos';

/**
 * World analytics (KNG-34 link 7, DESIGN.md D10/D11): a movement heatmap per world, menu funnels and
 * domain interactions over a range of local days. Anonymous aggregates from the plugin - nothing here
 * names a player. Owner only (exact grant of knk.owner.analytics.view; the API answers 403 otherwise).
 */

const isForbidden = (err: unknown) => (err as { status?: number })?.status === 403;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');
const fmt = (n: number) => n.toLocaleString();

const isoDay = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** Sum of a menu's action steps with one outcome. */
const actions = (menu: MenuFunnelDto, outcome: string) =>
  menu.steps.filter(s => s.step.startsWith('action:') && s.outcome === outcome).reduce((a, s) => a + s.count, 0);

export const OwnerAnalyticsPage: React.FC = () => {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [range, setRange] = useState<AnalyticsRange>({ from, to });
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [worlds, setWorlds] = useState<HeatmapWorldDto[] | null>(null);
  const [world, setWorld] = useState('');
  const [cellSize, setCellSize] = useState<number | undefined>(undefined);
  const [heatmap, setHeatmap] = useState<HeatmapDto | null>(null);
  const [funnels, setFunnels] = useState<MenuFunnelReportDto | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [domains, setDomains] = useState<DomainInteractionReportDto | null>(null);

  const fail = useCallback((err: unknown) => {
    if (isForbidden(err)) setForbidden(true);
    else setError(messageOf(err));
  }, []);

  useEffect(() => {
    setError(null);
    worldAnalyticsClient.getWorlds(range)
      .then(list => {
        setWorlds(list);
        setWorld(current => (current && list.some(w => w.world === current) ? current : list[0]?.world ?? ''));
      })
      .catch(fail);
    worldAnalyticsClient.getMenuFunnels(range).then(setFunnels).catch(fail);
    worldAnalyticsClient.getDomains(range).then(setDomains).catch(fail);
  }, [range, fail]);

  useEffect(() => {
    if (!world) {
      setHeatmap(null);
      return;
    }
    worldAnalyticsClient.getHeatmap(world, range, cellSize).then(setHeatmap).catch(fail);
  }, [world, range, cellSize, fail]);

  if (forbidden) return <OwnerOnlyNotice node={OWNER_ANALYTICS_VIEW_NODE} />;

  const stored = worlds?.find(w => w.world === world)?.cellSizes ?? [];
  const base = stored[0] ?? 16;
  const sizeOptions = [1, 2, 4, 8, 16].map(f => base * f).filter(s => s <= 1024);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <MapIcon className="h-6 w-6" /> World analytics
        </h1>
        <form
          className="flex flex-wrap items-end gap-2 text-sm"
          onSubmit={e => { e.preventDefault(); setRange({ from, to }); }}
        >
          <label className="flex flex-col text-xs text-gray-600">From
            <input aria-label="From" type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-gray-600">To
            <input aria-label="To" type="date" value={to} onChange={e => setTo(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className="rounded bg-primary px-3 py-1 text-sm font-medium text-white">Apply</button>
        </form>
      </div>
      <p className="text-xs text-gray-500">
        Anonymous counts from the game server (days in the server's statistics time zone, at most 92 days, kept 180 days).
      </p>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      <section aria-label="Movement heatmap" className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-gray-900">Movement heatmap</h2>
          <select aria-label="World" value={world} onChange={e => { setWorld(e.target.value); setCellSize(undefined); }}
            className="rounded border border-gray-300 px-2 py-1 text-sm">
            {(worlds ?? []).map(w => <option key={w.world} value={w.world}>{w.world} ({fmt(w.samples)} samples)</option>)}
          </select>
          <select aria-label="Cell size" value={cellSize ?? ''} onChange={e => setCellSize(e.target.value ? Number(e.target.value) : undefined)}
            className="rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">Finest</option>
            {sizeOptions.map(s => <option key={s} value={s}>{s} blocks</option>)}
          </select>
          {heatmap && (
            <span className="text-xs text-gray-500">
              {fmt(heatmap.totalSamples)} samples in {fmt(heatmap.cells.length)} cells of {heatmap.cellSize} blocks
              {heatmap.truncated && ' (busiest cells only - pick a larger cell size)'}
            </span>
          )}
        </div>
        {worlds && worlds.length === 0 && <p className="text-sm text-gray-500">No movement samples in this range.</p>}
        {heatmap && <HeatmapCanvas heatmap={heatmap} />}
        <p className="text-xs text-gray-500">One sample per online player every 10 s; AFK players, spectators and excluded game modes are not sampled.</p>
      </section>

      <section aria-label="Menu funnels" className="bg-white rounded-lg border border-gray-200">
        <h2 className="font-semibold text-gray-900 px-4 py-2 border-b border-gray-100">Menu funnels</h2>
        {funnels && funnels.menus.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No menu activity in this range.</p>}
        {funnels && funnels.menus.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 text-left">
              <tr>
                <th className="px-4 py-1 font-medium">Menu</th>
                <th className="px-2 py-1 font-medium text-right">Opened</th>
                <th className="px-2 py-1 font-medium text-right">Actions ok</th>
                <th className="px-2 py-1 font-medium text-right">Denied</th>
                <th className="px-2 py-1 font-medium text-right">Failed</th>
                <th className="px-2 py-1 font-medium text-right">Back</th>
                <th className="px-4 py-1 font-medium text-right">Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funnels.menus.map(menu => (
                <React.Fragment key={menu.menuKey}>
                  <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenMenu(openMenu === menu.menuKey ? null : menu.menuKey)}>
                    <td className="px-4 py-1.5 font-mono text-xs">
                      <button type="button" aria-expanded={openMenu === menu.menuKey} className="hover:underline">{menu.menuKey}</button>
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmt(menu.opened)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(actions(menu, 'succeeded'))}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(actions(menu, 'denied'))}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(actions(menu, 'failed'))}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(menu.back)}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(menu.closed)}</td>
                  </tr>
                  {openMenu === menu.menuKey && (
                    <tr>
                      <td colSpan={7} className="px-6 pb-3">
                        <ul aria-label={`Steps of ${menu.menuKey}`} className="text-xs space-y-0.5">
                          {menu.steps.map(s => (
                            <li key={`${s.step}|${s.outcome}`} className="flex gap-2">
                              <span className="font-mono">{s.step}</span>
                              <span className="text-gray-500">{s.outcome}</span>
                              <span className="ml-auto">{fmt(s.count)}</span>
                              {menu.opened > 0 && <span className="w-14 text-right text-gray-500">{Math.round((100 * s.count) / menu.opened)}%</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-4 py-2 text-xs text-gray-500">
          Percentages are of the menu's opens. "Closed" counts every close of the inventory, including when another menu replaces it.
        </p>
      </section>

      <section aria-label="Domain interactions" className="bg-white rounded-lg border border-gray-200">
        <h2 className="font-semibold text-gray-900 px-4 py-2 border-b border-gray-100">Domain interactions</h2>
        {domains && domains.domains.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No domain activity in this range.</p>}
        {domains && domains.domains.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 text-left">
              <tr>
                <th className="px-4 py-1 font-medium">Domain</th>
                <th className="px-2 py-1 font-medium text-right">Entries</th>
                <th className="px-2 py-1 font-medium text-right">Exits</th>
                <th className="px-2 py-1 font-medium text-right">Discoveries</th>
                <th className="px-2 py-1 font-medium text-right" title="Sum of each day's distinct visitors">Visitor-days</th>
                <th className="px-4 py-1 font-medium text-right">Peak visitors / day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {domains.domains.map(d => (
                <tr key={d.domainId}>
                  <td className="px-4 py-1.5">
                    {d.name ?? <span className="text-gray-500 italic">deleted domain</span>}
                    <span className="ml-2 text-xs text-gray-500">#{d.domainId}{d.regionId ? ` · ${d.regionId}` : ''}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmt(d.enter)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(d.leave)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(d.discover)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(d.visitorDays)}</td>
                  <td className="px-4 py-1.5 text-right">{fmt(d.peakDailyVisitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
