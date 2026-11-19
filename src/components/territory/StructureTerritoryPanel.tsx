import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { territoryClient } from '../../apiClients/territoryClient';
import { townClient } from '../../apiClients/townClient';
import { StructureTerritoryDto } from '../../types/dtos/territory/TerritoryDtos';
import { TownDto } from '../../types/dtos/town/TownDto';
import { useAllNodesGate } from '../../hooks/useActionGate';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { displayPath } from '../../utils/returnTo';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../utils/toast';
import { territoryFlagLabel } from '../../utils/territory';
import { TERRITORY_WRITE_NODES } from './TownTerritoryPanel';

interface Props {
    structureId: number;
    /** This page, so the conflict's or a town's page comes back here. */
    returnTo: string | null;
}

/**
 * A structure's territory (territory DESIGN § 4, acceptance A07; PandiO/knk-workspace#690): the flag the game server's
 * report sets when its land is outside its town's territory or contested (with the conflict), and its loyalty, which
 * V1 only stores. The structure keeps its owner either way. Staff with knk.admin.world set the loyalty and can clear a
 * flag by hand (the next report sets it again while it still applies).
 */
export const StructureTerritoryPanel: React.FC<Props> = ({ structureId, returnTo }) => {
    const writeGate = useAllNodesGate(TERRITORY_WRITE_NODES);
    const [territory, setTerritory] = useState<StructureTerritoryDto | null>(null);
    const [towns, setTowns] = useState<TownDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loyalty, setLoyalty] = useState('');
    const [busy, setBusy] = useState(false);

    const apply = (t: StructureTerritoryDto) => {
        setTerritory(t);
        setLoyalty(t.loyaltyTownId != null ? String(t.loyaltyTownId) : '');
    };

    const load = useCallback(async () => {
        setError(null);
        try {
            const [t, list] = await Promise.all([
                territoryClient.getStructure(structureId),
                townClient.getAll().catch(() => [] as TownDto[]),
            ]);
            apply(t);
            setTowns(list ?? []);
        } catch (err) {
            setError(apiRefusalReason(err) ?? "Couldn't load the structure's territory.");
        }
    }, [structureId]);

    useEffect(() => {
        setTerritory(null);
        void load();
    }, [load]);

    const saveLoyalty = async () => {
        setBusy(true);
        try {
            apply(await territoryClient.setLoyalty(structureId, { loyaltyTownId: loyalty ? Number(loyalty) : null }));
            toast.success('Loyalty saved.');
        } catch (err) {
            toast.error(apiRefusalReason(err) ?? 'The loyalty could not be saved.');
        } finally {
            setBusy(false);
        }
    };

    const clearFlag = async () => {
        setBusy(true);
        try {
            apply(await territoryClient.clearFlag(structureId));
            toast.success('Flag cleared.');
        } catch (err) {
            toast.error(apiRefusalReason(err) ?? 'The flag could not be cleared.');
        } finally {
            setBusy(false);
        }
    };

    const ownTown = territory?.townId != null ? towns.find(t => t.id === territory.townId) : undefined;
    const flagged = territory && territory.territoryFlag !== 'None';
    const loyaltyChanged = territory && loyalty !== (territory.loyaltyTownId != null ? String(territory.loyaltyTownId) : '');

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-territory-heading" data-testid="structure-territory">
            <h2 id="structure-territory-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <Flag className="mr-2 h-5 w-5" aria-hidden="true" />
                Territory and loyalty
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !territory && <p className="text-sm text-muted">Loading the territory…</p>}
            {territory && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted">Territory</dt>
                            <dd className={`font-medium ${flagged ? 'text-warning-strong' : 'text-fg'}`} data-testid="structure-territory-flag">
                                {territoryFlagLabel(territory.territoryFlag)}
                                {flagged && territory.territoryFlaggedAt ? ` (since ${formatDateTime(territory.territoryFlaggedAt)})` : ''}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Conflict</dt>
                            <dd className="text-fg">
                                {territory.territoryConflictId != null
                                    ? <Link to={displayPath('TerritoryConflict', territory.territoryConflictId, returnTo)} className="text-primary hover:underline">
                                        Conflict #{territory.territoryConflictId}
                                    </Link>
                                    : 'None'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Own town</dt>
                            <dd className="text-fg">
                                {territory.townId != null
                                    ? <Link to={displayPath('Town', territory.townId, returnTo)} className="text-primary hover:underline">{ownTown?.name ?? `Town #${territory.townId}`}</Link>
                                    : 'None'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Loyal to</dt>
                            <dd className="text-fg" data-testid="structure-loyalty">{territory.loyaltyTownName ?? 'Its own town'}</dd>
                        </div>
                    </dl>
                    <form
                        className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
                        aria-label="Loyalty"
                        onSubmit={e => { e.preventDefault(); void saveLoyalty(); }}
                    >
                        <div>
                            <label htmlFor="structure-loyalty-town" className="mb-1 block text-sm font-medium text-fg">Loyalty</label>
                            <select
                                id="structure-loyalty-town"
                                className="input px-3 py-2"
                                value={loyalty}
                                disabled={!writeGate.allowed || busy}
                                title={writeGate.hint ?? undefined}
                                onChange={e => setLoyalty(e.target.value)}
                            >
                                <option value="">Its own town</option>
                                {towns.filter(t => t.id !== territory.townId).map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn-primary text-sm" disabled={!writeGate.allowed || busy || !loyaltyChanged} title={writeGate.hint ?? undefined}>
                            Save loyalty
                        </button>
                        {flagged && (
                            <button type="button" className="btn-secondary text-sm" disabled={!writeGate.allowed || busy} title={writeGate.hint ?? undefined} onClick={() => void clearFlag()}>
                                Clear flag
                            </button>
                        )}
                    </form>
                    <p className="mt-2 text-xs text-muted">
                        Loyalty is stored only for now (territory V1): nothing switches sides. The flag comes from the game server's
                        territory report; the structure keeps its owner.
                    </p>
                    {writeGate.hint && <p className="mt-1 text-xs text-muted">{writeGate.hint}</p>}
                </>
            )}
        </section>
    );
};

export default StructureTerritoryPanel;
