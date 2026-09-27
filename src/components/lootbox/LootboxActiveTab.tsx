import React from 'react';
import { Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import { lootboxSpawnClient } from '../../apiClients/lootboxSpawnClient';
import { LootboxSpawnDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, formatDateTime, starLabel } from '../../utils/lootbox';

/**
 * Boxes standing in the world right now (docs/specs/lootboxes/DESIGN.md §3.3 GET active). Despawn
 * marks a box Removed; the game server drops its entities on its next refresh and it can no longer
 * be claimed. The API records the web admin as the actor.
 */
export const LootboxActiveTab: React.FC = () => {
    const [spawns, setSpawns] = React.useState<LootboxSpawnDto[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [confirmId, setConfirmId] = React.useState<number | null>(null);
    const [despawningId, setDespawningId] = React.useState<number | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const loaded = await lootboxSpawnClient.getActive();
            setSpawns([...loaded].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the active boxes.'));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const despawn = async (spawn: LootboxSpawnDto) => {
        setDespawningId(spawn.id);
        setError(null);
        setNotice(null);
        try {
            const result = await lootboxSpawnClient.despawn(spawn.id);
            setSpawns(prev => prev.filter(s => s.id !== spawn.id));
            setNotice(result?.status && result.status !== 'Removed'
                ? `Box #${spawn.id} was already ${result.status.toLowerCase()}.`
                : `Box #${spawn.id} removed.`);
        } catch (err) {
            setError(apiErrorMessage(err, `Could not despawn box #${spawn.id}.`));
        } finally {
            setDespawningId(null);
            setConfirmId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <p className="text-sm text-gray-600">
                    {loading ? 'Loading…' : `${spawns.length} active box${spawns.length === 1 ? '' : 'es'}.`} Expired boxes drop off on the next read.
                </p>
                <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                    <RefreshCcw className="h-4 w-4" /> Reload
                </button>
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {notice && <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

            {loading && spawns.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading active boxes…
                </div>
            ) : spawns.length === 0 ? (
                !error && <p className="text-sm text-gray-500">No box is standing in the world.</p>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-2">#</th>
                                <th className="px-4 py-2">Box</th>
                                <th className="px-4 py-2">Area</th>
                                <th className="px-4 py-2">Position</th>
                                <th className="px-4 py-2">Spawned</th>
                                <th className="px-4 py-2">Expires</th>
                                <th className="px-4 py-2 sr-only">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {spawns.map(spawn => (
                                <tr key={spawn.id} data-testid="active-row">
                                    <td className="px-4 py-2 text-gray-500">{spawn.id}</td>
                                    <td className="px-4 py-2 font-medium text-gray-900">
                                        {spawn.boxLabel || spawn.lootboxTypeName} <span className="text-amber-600">{starLabel(spawn.boxStars)}</span>
                                    </td>
                                    <td className="px-4 py-2">{spawn.spawnAreaName ?? (spawn.createdByUserId != null ? 'Staff spawn' : '-')}</td>
                                    <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{spawn.world} {spawn.x} {spawn.y} {spawn.z}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(spawn.spawnedAt)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(spawn.expiresAt)}</td>
                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                        {confirmId === spawn.id ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => void despawn(spawn)}
                                                    disabled={despawningId === spawn.id}
                                                    className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    {despawningId === spawn.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                    Confirm despawn
                                                </button>
                                                <button type="button" onClick={() => setConfirmId(null)} className="ml-2 text-xs text-gray-500 hover:underline">
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmId(spawn.id)}
                                                aria-label={`Despawn box ${spawn.id}`}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                                            >
                                                <Trash2 className="h-3 w-3" /> Despawn
                                            </button>
                                        )}
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

export default LootboxActiveTab;
