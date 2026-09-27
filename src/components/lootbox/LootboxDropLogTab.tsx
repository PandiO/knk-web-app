import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search } from 'lucide-react';
import { lootboxClaimClient } from '../../apiClients/lootboxClaimClient';
import { lootboxTypeClient } from '../../apiClients/lootboxTypeClient';
import { GradeClient } from '../../apiClients/gradeClient';
import { GradeDto } from '../../types/dtos/grade/GradeDtos';
import { LootboxClaimLogDto, LootboxClaimSearchFilters, LootboxClaimSource, LootboxTypeDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, formatDateTime, starLabel } from '../../utils/lootbox';
import { ItemInstanceDetail } from './ItemInstanceDetail';

/**
 * The drop log (docs/specs/lootboxes/DESIGN.md §3.3 LootboxClaims/search): every box a player opened
 * or token item they opened and every staff give, newest first. Specials are highlighted, claims whose item hasn't reached the
 * player yet are flagged (the game server redelivers them on join), and the minted item's instance id
 * opens its detail - the same lookup as typing an id read from an item's tag.
 */

export const DROP_LOG_PAGE_SIZE = 25;

type TriState = '' | 'true' | 'false';

interface FilterState {
    searchTerm: string;
    lootboxTypeId: string;
    itemGradeId: string;
    isSpecial: TriState;
    delivered: TriState;
    source: '' | LootboxClaimSource;
    /** yyyy-mm-dd, a UTC calendar day (the daily cap's day). */
    fromDate: string;
    toDate: string;
}

const EMPTY_FILTERS: FilterState = {
    searchTerm: '', lootboxTypeId: '', itemGradeId: '', isSpecial: '', delivered: '', source: '', fromDate: '', toDate: '',
};

const nextUtcDay = (date: string): string => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
};

/** The API's filter dictionary: only the filters that are set; "to" is exclusive, so the chosen day is included. */
export function toClaimSearchFilters(f: FilterState): LootboxClaimSearchFilters {
    const filters: LootboxClaimSearchFilters = {};
    if (f.lootboxTypeId) filters.lootboxTypeId = f.lootboxTypeId;
    if (f.itemGradeId) filters.itemGradeId = f.itemGradeId;
    if (f.isSpecial) filters.isSpecial = f.isSpecial;
    if (f.delivered) filters.delivered = f.delivered;
    if (f.source) filters.source = f.source;
    if (f.fromDate) filters.from = new Date(`${f.fromDate}T00:00:00Z`).toISOString();
    if (f.toDate) filters.to = nextUtcDay(f.toDate);
    return filters;
}

/** Where the claim came from: a world box, a token item (Phase 5) or a staff give. */
export function claimSourceLabel(row: LootboxClaimLogDto): string {
    if (row.lootboxTokenId != null || row.source === 'Token') return `token item #${row.lootboxTokenId ?? '?'}`;
    if (row.lootboxSpawnId != null) return `box #${row.lootboxSpawnId}`;
    return 'staff give';
}

const selectClass = 'rounded-md border-gray-300 shadow-sm text-sm';

export const LootboxDropLogTab: React.FC = () => {
    const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);
    const [searchDraft, setSearchDraft] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [rows, setRows] = React.useState<LootboxClaimLogDto[]>([]);
    const [totalCount, setTotalCount] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [types, setTypes] = React.useState<LootboxTypeDto[]>([]);
    const [grades, setGrades] = React.useState<GradeDto[]>([]);
    const [instanceDraft, setInstanceDraft] = React.useState('');
    const [instanceId, setInstanceId] = React.useState<number | null>(null);

    // Filter options; the log works without them.
    React.useEffect(() => {
        lootboxTypeClient.getAll()
            .then(loaded => setTypes([...loaded].sort((a, b) => a.name.localeCompare(b.name))))
            .catch(err => console.error('Failed to load lootbox types for the drop-log filter:', err));
        GradeClient.getInstance().getAll()
            .then(loaded => setGrades([...loaded].sort((a, b) => a.stars - b.stars)))
            .catch(err => console.error('Failed to load grades for the drop-log filter:', err));
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await lootboxClaimClient.search({
                pageNumber: page,
                pageSize: DROP_LOG_PAGE_SIZE,
                searchTerm: filters.searchTerm.trim() || undefined,
                filters: toClaimSearchFilters(filters),
            });
            setRows(result?.items ?? []);
            setTotalCount(result?.totalCount ?? 0);
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the drop log.'));
        } finally {
            setLoading(false);
        }
    }, [filters, page]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / DROP_LOG_PAGE_SIZE));

    const openInstance = (event: React.FormEvent) => {
        event.preventDefault();
        const id = Number(instanceDraft.trim());
        if (Number.isInteger(id) && id > 0) setInstanceId(id);
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={e => {
                        e.preventDefault();
                        setFilter('searchTerm', searchDraft);
                    }}
                >
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Player or item</span>
                        <input
                            type="search"
                            aria-label="Player or item"
                            value={searchDraft}
                            onChange={e => setSearchDraft(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm text-sm"
                        />
                    </label>
                    <button type="submit" className="btn-secondary inline-flex items-center gap-1"><Search className="h-4 w-4" /> Search</button>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Box type</span>
                        <select aria-label="Box type filter" value={filters.lootboxTypeId} onChange={e => setFilter('lootboxTypeId', e.target.value)} className={selectClass}>
                            <option value="">All types</option>
                            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Item grade</span>
                        <select aria-label="Item grade filter" value={filters.itemGradeId} onChange={e => setFilter('itemGradeId', e.target.value)} className={selectClass}>
                            <option value="">All grades</option>
                            {grades.map(g => <option key={g.id} value={g.id}>{starLabel(g.stars)} {g.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Specials</span>
                        <select aria-label="Special filter" value={filters.isSpecial} onChange={e => setFilter('isSpecial', e.target.value as TriState)} className={selectClass}>
                            <option value="">All drops</option>
                            <option value="true">Specials only</option>
                            <option value="false">No specials</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Delivery</span>
                        <select aria-label="Delivery filter" value={filters.delivered} onChange={e => setFilter('delivered', e.target.value as TriState)} className={selectClass}>
                            <option value="">Any</option>
                            <option value="true">Delivered</option>
                            <option value="false">Not delivered yet</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Source</span>
                        <select aria-label="Source filter" value={filters.source} onChange={e => setFilter('source', e.target.value as FilterState['source'])} className={selectClass}>
                            <option value="">Every source</option>
                            <option value="World">World boxes</option>
                            <option value="Token">Token items</option>
                            <option value="AdminGive">Staff gives</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">From (UTC day)</span>
                        <input type="date" aria-label="From day" value={filters.fromDate} onChange={e => setFilter('fromDate', e.target.value)} className={selectClass} />
                    </label>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">To (UTC day)</span>
                        <input type="date" aria-label="To day" value={filters.toDate} onChange={e => setFilter('toDate', e.target.value)} className={selectClass} />
                    </label>
                    <button
                        type="button"
                        onClick={() => { setSearchDraft(''); setFilters(EMPTY_FILTERS); setPage(1); }}
                        className="text-xs text-gray-500 hover:underline pb-2"
                    >
                        Clear
                    </button>
                </form>
                <form className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3" onSubmit={openInstance}>
                    <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">Item instance id (from the item's tag)</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            aria-label="Item instance id"
                            value={instanceDraft}
                            onChange={e => setInstanceDraft(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm text-sm"
                        />
                    </label>
                    <button type="submit" className="btn-secondary">Look up</button>
                </form>
            </div>

            {instanceId != null && <ItemInstanceDetail instanceId={instanceId} onClose={() => setInstanceId(null)} />}

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <tr>
                            <th className="px-3 py-2">When</th>
                            <th className="px-3 py-2">Player</th>
                            <th className="px-3 py-2">Box</th>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Instance</th>
                            <th className="px-3 py-2">Delivery</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map(row => (
                            <tr key={row.id} data-testid="drop-row" className={row.isSpecial ? 'bg-purple-50' : undefined}>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                    {formatDateTime(row.claimedAt)}
                                    <span className="block text-xs text-gray-400">claim #{row.id}</span>
                                </td>
                                <td className="px-3 py-2">
                                    <Link to={`/admin/users/${row.userId}`} className="text-primary hover:underline">{row.username ?? `User #${row.userId}`}</Link>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {row.lootboxTypeName ?? `Type #${row.lootboxTypeId}`} <span className="text-amber-600">{starLabel(row.boxStars)}</span>
                                    <span className="block text-xs text-gray-400">{claimSourceLabel(row)}</span>
                                </td>
                                <td className="px-3 py-2">
                                    <span className={row.isSpecial ? 'font-semibold text-purple-800' : 'text-gray-900'}>{row.itemName ?? `Blueprint #${row.itemBlueprintId}`}</span>
                                    {row.quantity > 1 && <span className="text-gray-500"> ×{row.quantity}</span>}
                                    {' '}<span className="text-amber-600">{starLabel(row.itemStars)}</span>
                                    {row.isSpecial && <span className="ml-1 rounded bg-purple-200 px-1 text-xs text-purple-900">special</span>}
                                </td>
                                <td className="px-3 py-2">
                                    {row.itemInstanceId != null ? (
                                        <button type="button" onClick={() => setInstanceId(row.itemInstanceId!)} className="font-mono text-xs text-primary hover:underline">
                                            #{row.itemInstanceId}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-400">stackable</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {row.deliveredAt ? (
                                        <span className="text-gray-600">{row.deliveryMethod ?? 'Delivered'}<span className="block text-xs text-gray-400">{formatDateTime(row.deliveredAt)}</span></span>
                                    ) : (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800" title="Redelivered when the player next joins">Not delivered</span>
                                    )}
                                    {row.deliveryNote && <span className="block text-xs text-gray-400">{row.deliveryNote}</span>}
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">No claims match.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                    {loading ? <Loader2 className="inline h-4 w-4 animate-spin" /> : `${totalCount.toLocaleString('en-US')} claim${totalCount === 1 ? '' : 's'}`}
                    {' '}· page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50" aria-label="Reload drop log">
                        <RefreshCcw className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={loading || page <= 1} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </button>
                    <button type="button" onClick={() => setPage(p => p + 1)} disabled={loading || page >= totalPages} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        Next <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LootboxDropLogTab;
