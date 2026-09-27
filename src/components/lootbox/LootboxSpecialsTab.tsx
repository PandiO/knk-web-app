import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Plus, RefreshCcw } from 'lucide-react';
import { lootboxSpecialEntryClient } from '../../apiClients/lootboxSpecialEntryClient';
import { LootboxSpecialEntryDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, formatPercent, perMillionToPercent, starLabel } from '../../utils/lootbox';

/**
 * Special (jackpot) entries (docs/specs/lootboxes/DESIGN.md §3.5): hand-designed items checked before
 * the normal roll, in sort order, each with its own chance - the first hit wins. Saving one tags its
 * blueprint "Lootbox Special", which takes it out of the normal pools. Edited in their FormWizard form;
 * the Odds tab shows what each one ends up at for a given box.
 */
export const LootboxSpecialsTab: React.FC = () => {
    const [entries, setEntries] = React.useState<LootboxSpecialEntryDto[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const loaded = await lootboxSpecialEntryClient.getAll();
            setEntries([...loaded].sort((a, b) =>
                (a.lootboxType?.name ?? '').localeCompare(b.lootboxType?.name ?? '') || a.sortOrder - b.sortOrder));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the special entries.'));
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
                    Checked before the normal roll, in sort order; the first hit wins and is given as designed, with its own
                    enchantments.
                </p>
                <div className="flex gap-2">
                    <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50">
                        <RefreshCcw className="h-4 w-4" /> Reload
                    </button>
                    <Link to="/forms/lootboxspecialentry" className="btn-primary inline-flex items-center gap-1">
                        <Plus className="h-4 w-4" /> New special
                    </Link>
                </div>
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            {loading && entries.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading special entries…
                </div>
            ) : entries.length === 0 && !error ? (
                <p className="text-sm text-gray-500">No special entries.</p>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-2">Item</th>
                                <th className="px-4 py-2">Box type</th>
                                <th className="px-4 py-2">Own chance</th>
                                <th className="px-4 py-2">From box</th>
                                <th className="px-4 py-2">Order</th>
                                <th className="px-4 py-2">Enabled</th>
                                <th className="px-4 py-2 sr-only">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {entries.map(entry => (
                                <tr key={entry.id} className={entry.enabled ? '' : 'text-gray-400'}>
                                    <td className="px-4 py-2 font-medium text-gray-900">{entry.itemBlueprint?.name ?? `Blueprint #${entry.itemBlueprintId}`}</td>
                                    <td className="px-4 py-2">{entry.lootboxType?.name ?? 'Any box'}</td>
                                    <td className="px-4 py-2">
                                        {formatPercent(perMillionToPercent(entry.chancePerMillion))}
                                        <span className="block text-xs text-gray-400">{entry.chancePerMillion.toLocaleString('en-US')} per million</span>
                                    </td>
                                    <td className="px-4 py-2">{starLabel(entry.minBoxStars)}+</td>
                                    <td className="px-4 py-2">{entry.sortOrder}</td>
                                    <td className="px-4 py-2">{entry.enabled ? 'Yes' : 'No'}</td>
                                    <td className="px-4 py-2 text-right">
                                        <Link to={`/forms/lootboxspecialentry/edit/${entry.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
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

export default LootboxSpecialsTab;
