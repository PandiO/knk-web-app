import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { shopTradeStatClient } from '../../apiClients/shopTradeStatClient';
import type { ShopTradeStatListDto } from '../../types/dtos/production/ShopDtos';
import { productionRefusalReason } from '../../utils/productionEngine';
import {
    SHOP_PAGE_MAX,
    TRADE_STATS_RANGES,
    TradeStatsHour,
    TradeStatsRange,
    formatCoins,
    formatUtcHour,
    hourlySeries,
    seriesTotals,
    statBlueprints,
    tradeStatsWindow,
} from '../../utils/shops';

interface Props {
    shopId: number;
    refreshKey?: number;
}

/** At most this many pages of 200 rows are read for one range (30 days of 13 items). */
const MAX_PAGES = 25;
const W = 720;
const H = 160;
const PAD_LEFT = 36;
const PAD_BOTTOM = 18;

function TradeChart({ series, label }: { series: TradeStatsHour[]; label: string }) {
    const max = Math.max(1, ...series.map(h => Math.max(h.unitsSold, h.unitsBoughtBack, h.unitsSupplied)));
    const plotW = W - PAD_LEFT - 4;
    const plotH = H - PAD_BOTTOM - 6;
    const slot = plotW / Math.max(1, series.length);
    const bar = Math.max(1, (slot - 1) / 3);
    const y = (v: number) => 6 + plotH - (v / max) * plotH;
    const ticks = [0, Math.round(max / 2), max];
    const labelEvery = Math.max(1, Math.ceil(series.length / 8));
    return (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full text-fg" data-testid="shop-trade-chart">
            {ticks.map(t => (
                <g key={t}>
                    <line x1={PAD_LEFT} x2={W - 4} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.15} />
                    <text x={PAD_LEFT - 4} y={y(t) + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.7}>{t}</text>
                </g>
            ))}
            {series.map((h, i) => {
                const x = PAD_LEFT + i * slot;
                return (
                    <g key={h.hourStart.getTime()}>
                        <title>{`${formatUtcHour(h.hourStart)}: ${h.unitsSold} sold, ${h.unitsBoughtBack} bought back, ${h.unitsSupplied} supplied`}</title>
                        {h.unitsSold > 0 && <rect x={x} y={y(h.unitsSold)} width={bar} height={y(0) - y(h.unitsSold)} className="fill-primary" />}
                        {h.unitsBoughtBack > 0 && <rect x={x + bar} y={y(h.unitsBoughtBack)} width={bar} height={y(0) - y(h.unitsBoughtBack)} fill="#d97706" />}
                        {h.unitsSupplied > 0 && <rect x={x + 2 * bar} y={y(h.unitsSupplied)} width={bar} height={y(0) - y(h.unitsSupplied)} fill="#64748b" />}
                        {i % labelEvery === 0 && (
                            <text x={x} y={H - 4} fontSize={9} fill="currentColor" fillOpacity={0.7}>
                                {series.length > 24 ? `${h.hourStart.getUTCDate()}/${h.hourStart.getUTCMonth() + 1}` : `${String(h.hourStart.getUTCHours()).padStart(2, '0')}h`}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

/**
 * A shop's hourly trade stats (PandiO/knk-workspace#688; shops DESIGN § 9.1, acceptance A18): per UTC hour the units
 * sold, bought back and supplied as a bar chart over the last 24 hours, 7 or 30 days, for all items or one, with the
 * totals and the rows per hour and item below. The rows are rolled up from the ledger every 10 minutes while production
 * is on; Rebuild recomputes the range now. Nothing in V1 pricing reads them.
 */
export const ShopTradeStatsPanel: React.FC<Props> = ({ shopId, refreshKey }) => {
    const [range, setRange] = useState<TradeStatsRange>('24h');
    const [blueprintId, setBlueprintId] = useState<string>('');
    const [rows, setRows] = useState<ShopTradeStatListDto[] | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rebuilding, setRebuilding] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [window, setWindow] = useState(() => tradeStatsWindow('24h', new Date()));

    const load = useCallback(async (selected: TradeStatsRange) => {
        const w = tradeStatsWindow(selected, new Date());
        setWindow(w);
        setError(null);
        try {
            const all: ShopTradeStatListDto[] = [];
            let total = 0;
            let page = 1;
            do {
                const result = await shopTradeStatClient.search({
                    pageNumber: page, pageSize: SHOP_PAGE_MAX,
                    filters: { shopId: String(shopId), from: w.from.toISOString(), to: w.to.toISOString() },
                });
                all.push(...(result.items ?? []));
                total = result.totalCount ?? all.length;
                page += 1;
            } while (all.length < total && page <= MAX_PAGES);
            setTruncated(all.length < total);
            setRows(all);
        } catch (err) {
            setRows(null);
            setError(productionRefusalReason(err) ?? "Couldn't load the trade stats.");
        }
    }, [shopId]);

    useEffect(() => {
        void load(range);
    }, [load, range, refreshKey]);

    const blueprints = useMemo(() => statBlueprints(rows ?? []), [rows]);
    const selectedBlueprint = blueprintId ? Number(blueprintId) : null;
    const series = useMemo(() => hourlySeries(rows ?? [], window.from, window.hours, selectedBlueprint), [rows, window, selectedBlueprint]);
    const totals = seriesTotals(series);
    const tableRows = (rows ?? [])
        .filter(row => selectedBlueprint == null || row.itemBlueprintId === selectedBlueprint)
        .sort((a, b) => b.hourStart.localeCompare(a.hourStart) || (a.itemBlueprintName ?? '').localeCompare(b.itemBlueprintName ?? ''));
    const rangeLabel = TRADE_STATS_RANGES.find(r => r.value === range)?.label ?? range;
    const itemLabel = selectedBlueprint == null ? 'all items' : blueprints.find(b => b.id === selectedBlueprint)?.name ?? `#${selectedBlueprint}`;

    const rebuild = async () => {
        setRebuilding(true);
        setNotice(null);
        setError(null);
        try {
            const result = await shopTradeStatClient.rebuild({ shopId, from: window.from.toISOString(), to: window.to.toISOString() });
            setNotice(`Rebuilt ${result.hours} hours from the ledger: ${result.rowsWritten} rows written, ${result.rowsDeleted} removed.`);
            void load(range);
        } catch (err) {
            setError(productionRefusalReason(err) ?? "Couldn't rebuild the trade stats.");
        } finally {
            setRebuilding(false);
        }
    };

    return (
        <div data-testid="shop-trade-stats">
            <h3 className="mt-6 mb-1 flex items-center text-base font-semibold text-fg">
                <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
                Trade stats per hour
            </h3>
            <p className="mb-2 text-xs text-muted">
                Rolled up from the stock and currency ledger per UTC hour; hours without trade have no row. Recorded for the later pricing model.
            </p>
            <div className="mb-2 flex flex-wrap items-end gap-3 text-sm">
                <div>
                    <label htmlFor="shop-stats-range" className="mb-1 block font-medium text-fg">Range</label>
                    <select id="shop-stats-range" className="input px-3 py-2" value={range} onChange={e => setRange(e.target.value as TradeStatsRange)}>
                        {TRADE_STATS_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="shop-stats-item" className="mb-1 block font-medium text-fg">Item</label>
                    <select id="shop-stats-item" className="input px-3 py-2" value={blueprintId} onChange={e => setBlueprintId(e.target.value)}>
                        <option value="">All items</option>
                        {blueprints.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <button type="button" className="btn-secondary text-sm" disabled={rebuilding} onClick={() => void rebuild()}>
                    {rebuilding ? 'Rebuilding…' : 'Rebuild from the ledger'}
                </button>
            </div>
            {notice && <p className="mb-2 text-sm text-fg" role="status" aria-label="Trade stats notice">{notice}</p>}
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && rows == null && <p className="text-sm text-muted">Loading the trade stats…</p>}
            {rows != null && (
                <>
                    <p className="text-sm" data-testid="shop-trade-totals">
                        {`${rangeLabel}, ${itemLabel}: ${totals.unitsSold} sold for ${formatCoins(totals.revenue)}, ${totals.unitsBoughtBack} bought back for ${formatCoins(totals.buyBackPaid)}, ${totals.unitsSupplied} supplied.`}
                    </p>
                    {truncated && <p className="text-xs text-warning-strong">Only the newest {rows.length} rows are shown; pick a shorter range.</p>}
                    <TradeChart series={series}
                        label={`Units per hour, ${rangeLabel.toLowerCase()}, ${itemLabel}: sold, bought back and supplied`} />
                    <p className="mb-2 flex flex-wrap gap-4 text-xs text-muted" aria-hidden="true">
                        <span><span className="mr-1 inline-block h-2 w-3 bg-primary" />Sold</span>
                        <span><span className="mr-1 inline-block h-2 w-3" style={{ background: '#d97706' }} />Bought back</span>
                        <span><span className="mr-1 inline-block h-2 w-3" style={{ background: '#64748b' }} />Supplied</span>
                    </p>
                    {tableRows.length === 0 ? <p className="text-sm text-muted" data-testid="shop-trade-none">No trade in this range.</p> : (
                        <div className="max-h-80 overflow-auto">
                            <table className="min-w-full text-left text-sm" aria-label="Trade stats rows">
                                <thead>
                                    <tr className="text-muted">
                                        <th className="pr-4 font-medium">Hour</th><th className="pr-4 font-medium">Item</th>
                                        <th className="pr-4 font-medium">Sold</th><th className="pr-4 font-medium">Revenue</th>
                                        <th className="pr-4 font-medium">Bought back</th><th className="pr-4 font-medium">Paid</th>
                                        <th className="pr-4 font-medium">Supplied</th><th className="font-medium">Stock at end</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map(row => (
                                        <tr key={row.id} className="border-t border-line">
                                            <td className="pr-4 py-1">{formatUtcHour(row.hourStart)}</td>
                                            <td className="pr-4 py-1">{row.itemBlueprintName ?? `#${row.itemBlueprintId}`}</td>
                                            <td className="pr-4 py-1">{row.unitsSold}</td>
                                            <td className="pr-4 py-1">{formatCoins(row.revenue)}</td>
                                            <td className="pr-4 py-1">{row.unitsBoughtBack}</td>
                                            <td className="pr-4 py-1">{formatCoins(row.buyBackPaid)}</td>
                                            <td className="pr-4 py-1">{row.unitsSupplied}</td>
                                            <td className="py-1">{row.stockAtEnd}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ShopTradeStatsPanel;
