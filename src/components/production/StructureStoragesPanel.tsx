import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { storageClient } from '../../apiClients/storageClient';
import { StorageListDto } from '../../types/dtos/stock/StockDtos';
import { displayPath } from '../../utils/returnTo';
import { enumLabel, stockRefusalReason } from '../../utils/stock';
import { formatNumber } from '../../utils/format';
import { StoragePanel } from '../stock/StoragePanel';

interface Props {
    structureId: number;
    structureName: string;
    /** This page, so a storage's page comes back here. */
    returnTo: string | null;
    /** After stock moved in one of the storages. */
    onChanged?: () => void;
}

/** The API's page cap for a search; a structure has a handful of storages (its default ones plus any made by hand). */
const PAGE_SIZE = 50;

/**
 * A structure's storages (PandiO/knk-workspace#676; production DESIGN § 4.1, § 11.1 "storage contents"): every storage
 * the structure holds (`POST api/Storages/search` with `domainId`: the default Output or Delivery storage made with it,
 * and any added by hand), each linked to its own page and shown with its stock (L5's storage panel, with the adjust and
 * move dialogs for holders of knk.economy.admin).
 */
export const StructureStoragesPanel: React.FC<Props> = ({ structureId, structureName, returnTo, onChanged }) => {
    const [storages, setStorages] = useState<StorageListDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const result = await storageClient.searchStorages({
                pageNumber: 1, pageSize: PAGE_SIZE, sortBy: 'id', filters: { domainId: String(structureId) },
            });
            setStorages(result?.items ?? []);
        } catch (err) {
            setError(stockRefusalReason(err) ?? "Couldn't load the structure's storages.");
        }
    }, [structureId]);

    useEffect(() => {
        setStorages(null);
        void load();
    }, [load]);

    return (
        <>
            <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-storages-heading" data-testid="structure-storages">
                <h2 id="structure-storages-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                    <WarehouseIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Storages
                </h2>
                {error && <p className="text-sm field-error" role="alert">{error}</p>}
                {!error && !storages && <p className="text-sm text-muted">Loading the storages…</p>}
                {storages && storages.length === 0 && (
                    <p className="text-sm text-muted">{structureName} holds no storages.</p>
                )}
                {storages && storages.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm" aria-label="Storages of this structure">
                            <thead>
                                <tr className="text-left text-muted">
                                    <th className="py-1 pr-4 font-medium">Storage</th>
                                    <th className="py-1 pr-4 font-medium">Purpose</th>
                                    <th className="py-1 pr-4 font-medium">Total units</th>
                                    <th className="py-1 font-medium">Distinct items</th>
                                </tr>
                            </thead>
                            <tbody>
                                {storages.map(storage => (
                                    <tr key={storage.id} className="border-t border-line">
                                        <td className="py-1 pr-4">
                                            <Link to={displayPath('Storage', storage.id, returnTo)} className="text-primary hover:underline">{storage.name}</Link>
                                        </td>
                                        <td className="py-1 pr-4">{storage.purpose ? enumLabel(storage.purpose) : '-'}</td>
                                        <td className="py-1 pr-4">
                                            {formatNumber(storage.totalUnits ?? 0)}
                                            {storage.maxUnits != null ? ` / ${formatNumber(storage.maxUnits)}` : ''}
                                        </td>
                                        <td className="py-1">{formatNumber(storage.distinctItems ?? 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
            {storages?.map(storage => (
                <StoragePanel
                    key={storage.id}
                    storageId={storage.id}
                    title={`Stock: ${storage.name}`}
                    returnTo={returnTo}
                    onChanged={() => { void load(); onChanged?.(); }}
                />
            ))}
        </>
    );
};

export default StructureStoragesPanel;
