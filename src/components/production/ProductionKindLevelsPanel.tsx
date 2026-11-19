import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { productionKindClient } from '../../apiClients/productionKindClient';
import { ProductionKindDto } from '../../types/dtos/production/ProductionEngineDtos';
import { displayPath } from '../../utils/returnTo';
import { blueprintName, formatNumber, productionRefusalReason, upgradeCostItems } from '../../utils/productionEngine';

interface Props {
    kindId: number;
    /** This page, so a level's page comes back here. */
    returnTo: string | null;
    refreshKey?: number;
}

/**
 * A production kind's ten levels (PandiO/knk-workspace#678; PRODUCTION_KINDS § 5, G8, acceptance A09): yield multiplier,
 * cycle speed, area cap, output cap, upgrade coins, upgrade cost and unlocks per level, each linked to the level's page
 * where its values and items are edited. Levels are created with the kind and can't be added or removed.
 */
export const ProductionKindLevelsPanel: React.FC<Props> = ({ kindId, returnTo, refreshKey }) => {
    const [kind, setKind] = useState<ProductionKindDto | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        productionKindClient.getById(kindId)
            .then(dto => { if (!cancelled) setKind(dto); })
            .catch(err => { if (!cancelled) setError(productionRefusalReason(err) ?? "Couldn't load the levels."); });
        return () => { cancelled = true; };
    }, [kindId, refreshKey]);

    const levels = [...(kind?.levels ?? [])].sort((a, b) => a.level - b.level);
    const items = (list: { itemBlueprintId: number; itemBlueprintName?: string | null; itemBlueprint?: { name?: string | null } | null; amount: number }[], withAmount: boolean) =>
        list.length === 0 ? '-' : list.map(item => withAmount ? `${item.amount} × ${blueprintName(item)}` : blueprintName(item)).join(', ');

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="production-kind-levels-heading" data-testid="production-kind-levels">
            <h2 id="production-kind-levels-heading" className="mb-1 flex items-center text-lg font-semibold text-fg">
                <Layers className="mr-2 h-5 w-5" aria-hidden="true" />
                Levels
            </h2>
            <p className="mb-4 text-sm text-muted">
                Every kind has levels 1 to 10. Open a level to change its multipliers, caps, upgrade cost and unlocks.
            </p>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !kind && <p className="text-sm text-muted">Loading the levels…</p>}
            {kind && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm" aria-label="Levels">
                        <thead>
                            <tr className="text-left text-muted">
                                <th className="py-1 pr-4 font-medium">Level</th>
                                <th className="py-1 pr-4 font-medium">Yield</th>
                                <th className="py-1 pr-4 font-medium">Cycle speed</th>
                                <th className="py-1 pr-4 font-medium">Max area</th>
                                <th className="py-1 pr-4 font-medium">Output cap</th>
                                <th className="py-1 pr-4 font-medium">Upgrade coins</th>
                                <th className="py-1 pr-4 font-medium">Upgrade cost</th>
                                <th className="py-1 pr-4 font-medium">Unlocks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {levels.map(level => (
                                <tr key={level.id} className="border-t border-line">
                                    <td className="py-1 pr-4">
                                        <Link to={displayPath('ProductionKindLevel', level.id, returnTo)} className="text-primary hover:underline">
                                            Level {level.level}
                                        </Link>
                                    </td>
                                    <td className="py-1 pr-4">× {formatNumber(level.yieldMultiplier, 3)}</td>
                                    <td className="py-1 pr-4">× {formatNumber(level.cycleSpeedMultiplier, 3)}</td>
                                    <td className="py-1 pr-4">{level.maxAreaSize ? level.maxAreaSize : 'No cap'}</td>
                                    <td className="py-1 pr-4">{level.outputMaxUnits ? level.outputMaxUnits : '-'}</td>
                                    <td className="py-1 pr-4">{level.upgradeCoins ?? 0}</td>
                                    <td className="py-1 pr-4">{items(upgradeCostItems(level), true)}</td>
                                    <td className="py-1 pr-4">{items((level.items ?? []).filter(i => i.role === 'Unlock'), false)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default ProductionKindLevelsPanel;
