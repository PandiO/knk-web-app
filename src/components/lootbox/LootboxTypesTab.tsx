import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Pencil, Percent, Plus, RefreshCcw } from 'lucide-react';
import { lootboxTypeClient } from '../../apiClients/lootboxTypeClient';
import { LootboxOddsDto, LootboxTypeDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, coveringBoxStars, coveringBoxStarsOf, emptyWindowStars, poolCountsByStars, reachableItemStars, starLabel } from '../../utils/lootbox';

/**
 * One row per lootbox type (one per item Category, docs/specs/lootboxes/DESIGN.md §3.2): whether it
 * spawns, how often, its box grades and how many pool items each item grade has, with a warning
 * when a grade its boxes can roll has none (those boxes fall back to a nearer grade). Everything
 * else - grade weights, pool entries, enchant rolls - is edited in the type's FormWizard form.
 */

type PoolState = { counts: Record<number, number>; empty: number[] } | 'error';

interface Props {
    onShowOdds: (typeId: number) => void;
}

export const LootboxTypesTab: React.FC<Props> = ({ onShowOdds }) => {
    const [types, setTypes] = React.useState<LootboxTypeDto[]>([]);
    const [pools, setPools] = React.useState<Record<number, PoolState>>({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [togglingId, setTogglingId] = React.useState<number | null>(null);
    const [rowError, setRowError] = React.useState<{ id: number; text: string } | null>(null);

    // The pool sizes come from the odds preview - the same pool rules the claim rolls with - a
    // couple of box grades per type, enough to cover every item grade its windows reach. One batch
    // request serves every type (KNG-45); each type then reads the grades that cover its own windows.
    const loadPools = React.useCallback(async (loaded: LootboxTypeDto[]) => {
        const withId = loaded.filter(type => type.id);
        if (withId.length === 0) return;
        try {
            const all = await lootboxTypeClient.getAllOdds(coveringBoxStarsOf(withId));
            const byType = new Map<number, LootboxOddsDto[]>();
            all.forEach(odds => byType.set(odds.lootboxTypeId, [...(byType.get(odds.lootboxTypeId) ?? []), odds]));
            const next: Record<number, PoolState> = {};
            withId.forEach(type => {
                const covering = coveringBoxStars(type);
                const odds = (byType.get(type.id!) ?? []).filter(o => covering.includes(o.boxStars));
                if (odds.length === 0) {
                    next[type.id!] = 'error';
                    return;
                }
                const counts = poolCountsByStars(odds);
                next[type.id!] = { counts, empty: emptyWindowStars(type, counts) };
            });
            setPools(prev => ({ ...prev, ...next }));
        } catch (err) {
            console.error('Failed to load the pools of the lootbox types:', err);
            const failed: Record<number, PoolState> = {};
            withId.forEach(type => { failed[type.id!] = 'error'; });
            setPools(prev => ({ ...prev, ...failed }));
        }
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        setPools({});
        try {
            const loaded = await lootboxTypeClient.getAll();
            const sorted = [...loaded].sort((a, b) => a.name.localeCompare(b.name));
            setTypes(sorted);
            void loadPools(sorted);
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the lootbox types.'));
        } finally {
            setLoading(false);
        }
    }, [loadPools]);

    React.useEffect(() => {
        void load();
    }, [load]);

    // PUT replaces the grade weights, pool entries and enchant rolls too, so it sends the type as
    // freshly read with only Enabled flipped.
    const toggleEnabled = async (type: LootboxTypeDto) => {
        if (!type.id) return;
        setTogglingId(type.id);
        setRowError(null);
        try {
            const current = await lootboxTypeClient.getById(type.id);
            await lootboxTypeClient.update({ ...current, enabled: !current.enabled });
            setTypes(prev => prev.map(t => (t.id === type.id ? { ...t, enabled: !current.enabled } : t)));
        } catch (err) {
            setRowError({ id: type.id, text: apiErrorMessage(err, `Could not ${type.enabled ? 'disable' : 'enable'} ${type.name}.`) });
        } finally {
            setTogglingId(null);
        }
    };

    const renderPool = (type: LootboxTypeDto) => {
        const pool = type.id ? pools[type.id] : undefined;
        if (pool === undefined) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
        if (pool === 'error') return <span className="text-xs text-gray-400">Unavailable</span>;
        return (
            <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                    {reachableItemStars(type).map(stars => (
                        <span
                            key={stars}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${pool.counts[stars] ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}
                        >
                            {starLabel(stars)}: {pool.counts[stars] ?? 0}
                        </span>
                    ))}
                </div>
                {pool.empty.length > 0 && (
                    <p className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        No {pool.empty.map(starLabel).join('/')} items: those rolls fall back to a nearer grade.
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <p className="text-sm text-gray-600">
                    One box type per item category; new types start disabled. Edit a type for its box-grade weights,
                    pool entries and enchantment rolls.
                </p>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        <RefreshCcw className="h-4 w-4" /> Reload
                    </button>
                    <Link to="/forms/lootboxtype" className="btn-primary inline-flex items-center gap-1">
                        <Plus className="h-4 w-4" /> New type
                    </Link>
                </div>
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            {loading && types.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading lootbox types…
                </div>
            ) : types.length === 0 && !error ? (
                <p className="text-sm text-gray-500">No lootbox types yet.</p>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Category</th>
                                <th className="px-4 py-2">Spawns</th>
                                <th className="px-4 py-2">Weight</th>
                                <th className="px-4 py-2">Box grades</th>
                                <th className="px-4 py-2">Daily limit</th>
                                <th className="px-4 py-2">Pool per item grade</th>
                                <th className="px-4 py-2 sr-only">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {types.map(type => (
                                <tr key={type.id} className={type.enabled ? '' : 'text-gray-500'}>
                                    <td className="px-4 py-2 font-medium text-gray-900">{type.name}</td>
                                    <td className="px-4 py-2">{type.category?.name ?? `#${type.categoryId}`}{type.includeSubcategories ? ' (+ subcategories)' : ''}</td>
                                    <td className="px-4 py-2">
                                        <button
                                            type="button"
                                            onClick={() => void toggleEnabled(type)}
                                            disabled={togglingId === type.id}
                                            aria-label={`${type.enabled ? 'Disable' : 'Enable'} ${type.name}`}
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${type.enabled ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                        >
                                            {togglingId === type.id ? '…' : type.enabled ? 'Enabled' : 'Disabled'}
                                        </button>
                                        {rowError?.id === type.id && <p className="mt-1 text-xs text-red-600">{rowError.text}</p>}
                                    </td>
                                    <td className="px-4 py-2">{type.spawnWeight}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {starLabel(type.minBoxStars)}-{starLabel(type.maxBoxStars)}
                                        <span className="block text-xs text-gray-400">items up to {type.itemStarSpread} below</span>
                                    </td>
                                    <td className="px-4 py-2">{type.maxClaimsPerPlayerPerDay ?? 'Global only'}</td>
                                    <td className="px-4 py-2">{renderPool(type)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                        <button
                                            type="button"
                                            onClick={() => type.id && onShowOdds(type.id)}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mr-3"
                                        >
                                            <Percent className="h-3 w-3" /> Odds
                                        </button>
                                        <Link to={`/forms/lootboxtype/edit/${type.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                            <Pencil className="h-3 w-3" /> Edit
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LootboxTypesTab;
