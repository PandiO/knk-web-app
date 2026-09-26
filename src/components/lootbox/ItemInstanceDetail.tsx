import React from 'react';
import { Loader2, X } from 'lucide-react';
import { itemInstanceClient } from '../../apiClients/itemInstanceClient';
import { ItemInstanceDto } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, formatDateTime, starLabel } from '../../utils/lootbox';

/**
 * One minted item (docs/specs/lootboxes/DESIGN.md §3.2): the id is what an item carries in its
 * knightsandkings:knk_item_instance tag, so two items with the same id are a provable dupe. Shows the
 * frozen grade, the final enchantment set, the owner and where it came from (for a lootbox, the
 * drop-log claim id).
 */
export const ItemInstanceDetail: React.FC<{ instanceId: number; onClose: () => void }> = ({ instanceId, onClose }) => {
    const [instance, setInstance] = React.useState<ItemInstanceDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setInstance(null);
        itemInstanceClient.getById(instanceId)
            .then(result => { if (!cancelled) setInstance(result); })
            .catch(err => {
                if (cancelled) return;
                const status = (err as { status?: number } | null)?.status;
                setError(status === 404 ? `No item instance #${instanceId}.` : apiErrorMessage(err, `Could not load item instance #${instanceId}.`));
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [instanceId]);

    const rows: [string, React.ReactNode][] = instance ? [
        ['Item', <>{instance.itemBlueprint?.name ?? `Blueprint #${instance.itemBlueprintId}`}{instance.customDisplayName && <span className="text-gray-500"> (renamed “{instance.customDisplayName}”)</span>}</>],
        ['Grade', instance.grade ? `${starLabel(instance.grade.stars)} ${instance.grade.name ?? ''}` : 'Ungraded'],
        ['Owner', instance.ownerUsername ?? (instance.ownerUserId != null ? `User #${instance.ownerUserId}` : 'None')],
        ['Origin', `${instance.origin}${instance.originRef ? ` · ${instance.origin === 'Lootbox' ? 'claim' : 'ref'} #${instance.originRef}` : ''}`],
        ['Minted', formatDateTime(instance.createdAt)],
        ['Owners so far', instance.ownerCount],
        ['Flags', [instance.isSoulbound && 'Soulbound', instance.isGhosted && 'Ghosted'].filter(Boolean).join(', ') || 'None'],
    ] : [];

    return (
        <section className="bg-white rounded-lg shadow p-4 md:p-6 border border-gray-200" aria-label={`Item instance ${instanceId}`}>
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-900">Item instance #{instanceId}</h3>
                <button type="button" onClick={onClose} aria-label="Close item instance" className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {loading ? (
                <div className="flex items-center py-6 text-gray-500"><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading…</div>
            ) : error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : instance && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                        {rows.map(([label, value]) => (
                            <React.Fragment key={label}>
                                <dt className="text-gray-500">{label}</dt>
                                <dd className="text-gray-900">{value}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Enchantments</h4>
                        {instance.enchantments.length === 0 ? (
                            <p className="text-sm text-gray-500">None</p>
                        ) : (
                            <ul className="text-sm space-y-0.5">
                                {instance.enchantments.map(e => (
                                    <li key={e.enchantmentDefinitionId}>
                                        {e.displayName || e.key} {e.level}
                                        {e.isCustom && <span className="ml-1 rounded bg-indigo-100 px-1 text-xs text-indigo-800">custom</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default ItemInstanceDetail;
