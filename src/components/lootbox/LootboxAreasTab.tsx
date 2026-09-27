import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Plus, RefreshCcw } from 'lucide-react';
import { lootboxSpawnAreaClient } from '../../apiClients/lootboxSpawnAreaClient';
import { LootboxSpawnAreaDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage } from '../../utils/lootbox';

/**
 * Spawn areas (docs/specs/lootboxes/DESIGN.md §3.2, D17): a WorldGuard region boxes may spawn in,
 * with its own limits. Areas made in game (/knk lootbox area create, enabled with default limits)
 * show up here like the ones made in the web app and are tuned with the same form.
 */
export const LootboxAreasTab: React.FC = () => {
    const [areas, setAreas] = React.useState<LootboxSpawnAreaDto[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const loaded = await lootboxSpawnAreaClient.getAll();
            setAreas([...loaded].sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the spawn areas.'));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <p className="text-sm text-gray-600">
                    Boxes only spawn inside an enabled area. In game, <code className="text-xs bg-gray-100 px-1 rounded">/knk lootbox area create &lt;name&gt;</code> turns
                    a WorldEdit selection into one.
                </p>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        <RefreshCcw className="h-4 w-4" /> Reload
                    </button>
                    <Link to="/forms/lootboxspawnarea" className="btn-primary inline-flex items-center gap-1">
                        <Plus className="h-4 w-4" /> New area
                    </Link>
                </div>
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            {loading && areas.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading spawn areas…
                </div>
            ) : areas.length === 0 && !error ? (
                <p className="text-sm text-gray-500">No spawn areas yet, so no box spawns.</p>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-2">Area</th>
                                <th className="px-4 py-2">Region</th>
                                <th className="px-4 py-2">Enabled</th>
                                <th className="px-4 py-2">Max active</th>
                                <th className="px-4 py-2">Every</th>
                                <th className="px-4 py-2">Needs online</th>
                                <th className="px-4 py-2">Lifetime</th>
                                <th className="px-4 py-2">Types</th>
                                <th className="px-4 py-2 sr-only">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {areas.map(area => (
                                <tr key={area.id} className={area.enabled ? '' : 'text-gray-400'}>
                                    <td className="px-4 py-2 font-medium text-gray-900">
                                        {area.name}
                                        {area.createdByUserId != null && <span className="block text-xs font-normal text-gray-400">made in game</span>}
                                    </td>
                                    <td className="px-4 py-2">{area.world} / {area.wgRegionId}</td>
                                    <td className="px-4 py-2">{area.enabled ? 'Yes' : 'No'}</td>
                                    <td className="px-4 py-2">{area.maxActive}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {area.spawnIntervalSeconds}s
                                        {area.spawnChancePercent < 100 && <span className="block text-xs text-gray-400">{area.spawnChancePercent}% chance</span>}
                                    </td>
                                    <td className="px-4 py-2">{area.minOnlinePlayers} players</td>
                                    <td className="px-4 py-2">{area.lifetimeMinutes} min</td>
                                    <td className="px-4 py-2">
                                        {area.allowedTypes.length === 0
                                            ? 'All enabled'
                                            : area.allowedTypes.map(t => t.lootboxType?.name ?? `#${t.lootboxTypeId}`).join(', ')}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <Link to={`/forms/lootboxspawnarea/edit/${area.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
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

export default LootboxAreasTab;
