import React from 'react';
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react';
import { lootboxTypeClient } from '../../apiClients/lootboxTypeClient';
import { LootboxEnchantOddsDto, LootboxOddsDto, LootboxTypeDto, MAX_BOX_STARS } from '../../types/dtos/lootbox/LootboxDtos';
import { apiErrorMessage, formatPercent, starLabel } from '../../utils/lootbox';

/**
 * The odds preview (docs/specs/lootboxes/DESIGN.md §3.1/§3.3): for one type and box grade, what the
 * API's roll engine gives - the same code path a real claim uses, so the preview can't drift. Specials
 * show their own chance and the chance that they are what the box gives (every special before them
 * missed); item grades are split within the normal roll; enchantments show how often they actually
 * land on the item, after applicable materials, grade caps and conflicts.
 */

interface Props {
    /** The type to show first (from the Types tab), if any. */
    typeId?: number | null;
    onTypeChange?: (typeId: number) => void;
}

const levelRange = (min?: number | null, max?: number | null): string => {
    if (min == null || max == null) return 'dropped';
    return min === max ? `${min}` : `${min}-${max}`;
};

const levelsByGrade = (enchant: LootboxEnchantOddsDto): string =>
    [...enchant.levelsByGrade]
        .sort((a, b) => a.stars - b.stars)
        .map(l => `${starLabel(l.stars)} ${levelRange(l.minLevel, l.maxLevel)}`)
        .join(' · ');

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <section className="bg-white rounded-lg shadow p-4 md:p-6 space-y-3">
        <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
        {children}
    </section>
);

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
    <th className={`px-3 py-2 ${right ? 'text-right' : ''}`}>{children}</th>
);

export const LootboxOddsTab: React.FC<Props> = ({ typeId, onTypeChange }) => {
    const [types, setTypes] = React.useState<LootboxTypeDto[]>([]);
    const [selectedId, setSelectedId] = React.useState<number | null>(typeId ?? null);
    const [boxStars, setBoxStars] = React.useState<number | null>(null);
    const [odds, setOdds] = React.useState<LootboxOddsDto | null>(null);
    const [loadingTypes, setLoadingTypes] = React.useState(true);
    const [loadingOdds, setLoadingOdds] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loaded = await lootboxTypeClient.getAll();
                if (cancelled) return;
                const sorted = [...loaded].sort((a, b) => a.name.localeCompare(b.name));
                setTypes(sorted);
                setSelectedId(current => current ?? sorted[0]?.id ?? null);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Could not load the lootbox types.'));
            } finally {
                if (!cancelled) setLoadingTypes(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    React.useEffect(() => {
        if (typeId != null) setSelectedId(typeId);
    }, [typeId]);

    const selectedType = types.find(t => t.id === selectedId) ?? null;
    const minStars = selectedType ? Math.max(1, selectedType.minBoxStars) : 1;
    const maxStars = selectedType ? Math.min(MAX_BOX_STARS, selectedType.maxBoxStars) : MAX_BOX_STARS;
    const starOptions = Array.from({ length: Math.max(0, maxStars - minStars + 1) }, (_, i) => minStars + i);
    // A new type starts at its best box grade; the chosen grade is kept while it is in range.
    const effectiveStars = boxStars != null && boxStars >= minStars && boxStars <= maxStars ? boxStars : maxStars;

    const loadOdds = React.useCallback(async (id: number, stars: number) => {
        setLoadingOdds(true);
        setError(null);
        try {
            setOdds(await lootboxTypeClient.getOdds(id, stars));
        } catch (err) {
            setOdds(null);
            setError(apiErrorMessage(err, 'Could not load the odds.'));
        } finally {
            setLoadingOdds(false);
        }
    }, []);

    React.useEffect(() => {
        if (selectedId != null && selectedType) void loadOdds(selectedId, effectiveStars);
    }, [selectedId, selectedType, effectiveStars, loadOdds]);

    if (loadingTypes) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading lootbox types…
            </div>
        );
    }

    const normal = odds?.normalRollPercent ?? 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Box type</span>
                    <select
                        aria-label="Box type"
                        value={selectedId ?? ''}
                        onChange={e => {
                            const id = Number(e.target.value);
                            setSelectedId(id);
                            onTypeChange?.(id);
                        }}
                        className="rounded-md border-gray-300 shadow-sm sm:text-sm"
                    >
                        {types.map(t => (
                            <option key={t.id} value={t.id}>{t.name}{t.enabled ? '' : ' (disabled)'}</option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Box grade</span>
                    <select
                        aria-label="Box grade"
                        value={effectiveStars}
                        onChange={e => setBoxStars(Number(e.target.value))}
                        className="rounded-md border-gray-300 shadow-sm sm:text-sm"
                    >
                        {starOptions.map(s => <option key={s} value={s}>{starLabel(s)}</option>)}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => selectedId != null && void loadOdds(selectedId, effectiveStars)}
                    disabled={loadingOdds || selectedId == null}
                    className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50"
                >
                    {loadingOdds ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
                </button>
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {types.length === 0 && !error && <p className="text-sm text-gray-500">No lootbox types yet.</p>}

            {odds && (
                <>
                    <Section title="How often this type spawns as each box grade">
                        {odds.boxGrades.length === 0 ? (
                            <p className="text-sm text-amber-700">No box grade has weight, so this type never spawns.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {odds.boxGrades.map(g => (
                                    <span key={g.gradeId} className={`rounded px-2 py-1 text-xs ${g.stars === odds.boxStars ? 'bg-primary/10 font-semibold text-gray-900 ring-1 ring-primary' : 'bg-gray-100 text-gray-700'}`}>
                                        {starLabel(g.stars)} {g.name}: {formatPercent(g.percent)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </Section>

                    <Section
                        title={`Specials in a ${starLabel(odds.boxStars)} box`}
                        description="Checked first, in order; each rolls its own chance and the first hit wins. “Gives it” is its own chance times every earlier special missing."
                    >
                        {odds.specials.length === 0 ? (
                            <p className="text-sm text-gray-500">No special can come out of this box.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                                    <tr><Th>Item</Th><Th right>Own chance</Th><Th right>Gives it</Th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {odds.specials.map(s => (
                                        <tr key={s.specialEntryId} data-testid="special-row">
                                            <td className="px-3 py-1.5 font-medium text-purple-800">{s.name}</td>
                                            <td className="px-3 py-1.5 text-right">{formatPercent(s.chancePercent)}</td>
                                            <td className="px-3 py-1.5 text-right">{formatPercent(s.percent)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <p className="text-sm text-gray-700">Normal roll: <strong>{formatPercent(normal)}</strong></p>
                    </Section>

                    <Section title="Item grades" description="Within the normal roll: the grade is drawn first (by the grade's drop chance), then an item of that grade, so more items of one grade don't dilute the others.">
                        {odds.windowWidened && (
                            <p className="flex items-center gap-1 text-sm text-amber-700">
                                <AlertTriangle className="h-4 w-4" />
                                No grade in this box's window has items; the nearest grade with items is used instead.
                            </p>
                        )}
                        {odds.itemGrades.length === 0 ? (
                            <p className="text-sm text-amber-700">The pool is empty: this box can only give a special (or nothing, and the claim is refused).</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                                    <tr><Th>Grade</Th><Th right>Pool items</Th><Th right>Of the normal roll</Th><Th right>Of the box</Th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {odds.itemGrades.map(g => (
                                        <tr key={g.gradeId} data-testid="item-grade-row">
                                            <td className="px-3 py-1.5">{starLabel(g.stars)} {g.name}</td>
                                            <td className="px-3 py-1.5 text-right">{g.itemCount ?? '-'}</td>
                                            <td className="px-3 py-1.5 text-right">{formatPercent(g.percent)}</td>
                                            <td className="px-3 py-1.5 text-right">{formatPercent(g.percent * normal / 100)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Section>

                    {odds.items.length > 0 && (
                        <Section title="Items">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                                        <tr><Th>Item</Th><Th>Grade</Th><Th right>Weight</Th><Th right>Qty</Th><Th right>In its grade</Th><Th right>Of the box</Th><Th>Enchant rolls</Th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {odds.items.map(i => (
                                            <tr key={i.itemBlueprintId}>
                                                <td className="px-3 py-1.5 font-medium text-gray-900">{i.name}</td>
                                                <td className="px-3 py-1.5">{starLabel(i.stars)}</td>
                                                <td className="px-3 py-1.5 text-right">{i.weight}</td>
                                                <td className="px-3 py-1.5 text-right">{i.quantity}</td>
                                                <td className="px-3 py-1.5 text-right">{formatPercent(i.percentWithinGrade)}</td>
                                                <td className="px-3 py-1.5 text-right font-medium">{formatPercent(i.percent)}</td>
                                                <td className="px-3 py-1.5 text-xs text-gray-500">{i.rollsEnchantments ? 'Yes' : 'No (book or stackable)'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Section>
                    )}

                    <Section
                        title="Enchantment rolls"
                        description="Hit = the roll's own chance on an item that can carry it. Lands = the chance this box gives an item with it from this roll, after materials that can't hold it, grade level caps and conflicts. Vanilla levels are capped by the item's grade; custom ones only by their maximum."
                    >
                        {odds.enchantments.length === 0 ? (
                            <p className="text-sm text-gray-500">No enchantment roll applies to this box grade.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                                        <tr><Th>Enchantment</Th><Th right>Hit</Th><Th>Rolled levels</Th><Th right>Items that can carry it</Th><Th right>Lands</Th><Th>Levels by item grade</Th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {odds.enchantments.map(e => (
                                            <tr key={e.enchantRollId} data-testid="enchant-row">
                                                <td className="px-3 py-1.5">
                                                    <span className="font-mono text-xs">{e.key}</span>
                                                    {e.isCustom && <span className="ml-1 rounded bg-indigo-100 px-1 text-xs text-indigo-800">custom</span>}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">{formatPercent(e.hitPercent)}</td>
                                                <td className="px-3 py-1.5">{levelRange(e.minLevel, e.maxLevel)}</td>
                                                <td className="px-3 py-1.5 text-right">{e.applicableItemCount}</td>
                                                <td className="px-3 py-1.5 text-right font-medium">{formatPercent(e.landPercent)}</td>
                                                <td className="px-3 py-1.5 text-xs text-gray-600">{levelsByGrade(e)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>
                </>
            )}
        </div>
    );
};

export default LootboxOddsTab;
