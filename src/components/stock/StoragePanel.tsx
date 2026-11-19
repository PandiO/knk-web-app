import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Lock, Package, SlidersHorizontal } from 'lucide-react';
import { storageClient } from '../../apiClients/storageClient';
import { useActionGate } from '../../hooks/useActionGate';
import { ECONOMY_ADMIN_NODE, StockResultDto, StorageDto } from '../../types/dtos/stock/StockDtos';
import { formatDateTime, formatNumber } from '../../utils/format';
import { displayPath } from '../../utils/returnTo';
import {
    capacityText,
    enumLabel,
    isLockedNow,
    isOverCap,
    itemInstanceMovesPath,
    lineMovesPath,
    stockRefusalReason,
    storageLedgerPath,
} from '../../utils/stock';
import { AdjustPreset, StockAdjustDialog } from './StockAdjustDialog';
import { StockMoveDialog } from './StockMoveDialog';
import { LookupPick } from './LookupPicker';

interface Props {
    storageId: number;
    /** This page, so a linked page comes back here. */
    returnTo: string | null;
    /** After stock moved: the details above re-read the totals. */
    onChanged?: () => void;
    /** P2 (PandiO/knk-workspace#676): the heading when several storages share a page (a structure's), default "Stock". */
    title?: string;
}

/**
 * A storage's stock (PandiO/knk-workspace#675; production DESIGN § 4.1-4.5, § 11.1): capacity in raw units × storage
 * weight against the cap, the lock, the stock lines (each amount links to the moves that made it, the ledger
 * explorer's drill-down) and the unique items (A03), with the adjust and move dialogs for holders of knk.economy.admin.
 */
export const StoragePanel: React.FC<Props> = ({ storageId, returnTo, onChanged, title }) => {
    const economyGate = useActionGate(ECONOMY_ADMIN_NODE);
    const [storage, setStorage] = useState<StorageDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [adjust, setAdjust] = useState<AdjustPreset | null>(null);
    const [moveBlueprint, setMoveBlueprint] = useState<LookupPick | null | undefined>(undefined);

    const load = useCallback(async () => {
        setError(null);
        try {
            setStorage(await storageClient.getById(storageId));
        } catch (err) {
            setError(stockRefusalReason(err) ?? "Couldn't load the storage's stock.");
        }
    }, [storageId]);

    useEffect(() => {
        setStorage(null);
        void load();
    }, [load]);

    const applied = (_result: StockResultDto) => {
        void load();
        onChanged?.();
    };

    const name = storage?.name ?? `Storage #${storageId}`;
    const self = useMemo<LookupPick>(() => ({ id: storageId, label: name }), [storageId, name]);
    const isVirtual = storage?.kind === 'Virtual';
    const locked = storage ? isLockedNow(storage) : false;
    const overCap = storage ? isOverCap(storage) : false;
    const lines = storage?.lines ?? [];
    const units = storage?.units ?? [];
    const gateProps = { disabled: !economyGate.allowed, title: economyGate.hint ?? undefined };

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby={`storage-stock-heading-${storageId}`} data-testid="storage-stock">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id={`storage-stock-heading-${storageId}`} className="flex items-center text-lg font-semibold text-fg">
                    <Package className="mr-2 h-5 w-5" aria-hidden="true" />
                    {title ?? 'Stock'}
                </h2>
                {storage && (
                    <div className="flex flex-wrap gap-2">
                        <Link to={storageLedgerPath(storageId)} className="btn-secondary text-sm">Ledger</Link>
                        <button type="button" className="btn-secondary text-sm" {...gateProps} onClick={() => setAdjust({})}>
                            <SlidersHorizontal className="mr-1 h-4 w-4" aria-hidden="true" />Adjust stock
                        </button>
                        <button type="button" className="btn-secondary text-sm" {...gateProps} onClick={() => setMoveBlueprint(null)}>
                            <ArrowRightLeft className="mr-1 h-4 w-4" aria-hidden="true" />Move stock
                        </button>
                    </div>
                )}
            </div>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !storage && <p className="text-sm text-muted">Loading the stock…</p>}
            {storage && (
                <>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted">Holder</dt>
                            <dd className="text-fg" data-testid="storage-holder">
                                {storage.domainId != null
                                    ? <Link to={displayPath('Domain', storage.domainId, returnTo)} className="text-primary hover:underline">{storage.holderName ?? `Domain #${storage.domainId}`}</Link>
                                    : storage.holderName ?? '-'}
                                {' '}({enumLabel(storage.kind)}{storage.purpose ? `, ${enumLabel(storage.purpose)}` : ''})
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Capacity used</dt>
                            <dd className={`font-medium ${overCap ? 'text-warning-strong' : 'text-fg'}`} data-testid="storage-capacity">
                                {isVirtual ? 'System storage: no cap' : capacityText(storage)}
                                {overCap && ' (over its cap: removals only)'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Total units</dt>
                            <dd className="text-fg" data-testid="storage-total">{formatNumber(storage.totalUnits ?? 0)}</dd>
                        </div>
                        <div>
                            <dt className="text-muted">Distinct items</dt>
                            <dd className="text-fg">
                                {formatNumber(storage.distinctItems ?? 0)}
                                {storage.maxDistinct != null ? ` of ${formatNumber(storage.maxDistinct)}` : ''}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Lock</dt>
                            <dd className={locked ? 'font-medium text-warning-strong' : 'text-fg'} data-testid="storage-lock">
                                {locked
                                    ? <><Lock className="mr-1 inline h-4 w-4" aria-hidden="true" />Locked until {formatDateTime(storage.lockedUntil)}{storage.lockReason ? `: ${storage.lockReason}` : ''}</>
                                    : 'Not locked'}
                            </dd>
                        </div>
                    </dl>
                    {locked && <p className="mt-2 text-xs text-muted">A locked storage refuses moves in and out (result Locked) until the lock ends.</p>}

                    <h3 className="mb-2 mt-6 text-base font-semibold text-fg">Stock lines</h3>
                    {lines.length === 0
                        ? <p className="text-sm text-muted">No stackable stock.</p>
                        : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm" aria-label="Stock lines">
                                    <thead>
                                        <tr className="text-left text-muted">
                                            <th className="py-1 pr-4 font-medium">Blueprint</th>
                                            <th className="py-1 pr-4 font-medium">Amount</th>
                                            <th className="py-1 pr-4 font-medium">Storage weight</th>
                                            <th className="py-1 pr-4 font-medium">Capacity used</th>
                                            <th className="py-1 pr-4 font-medium">Updated</th>
                                            <th className="py-1 font-medium"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map(line => {
                                            const label = line.itemBlueprintName ?? `Blueprint #${line.itemBlueprintId}`;
                                            return (
                                                <tr key={line.id} className="border-t border-line">
                                                    <td className="py-1 pr-4">
                                                        <Link to={displayPath('ItemBlueprint', line.itemBlueprintId, returnTo)} className="text-primary hover:underline">{label}</Link>
                                                    </td>
                                                    <td className="py-1 pr-4">
                                                        <Link to={lineMovesPath(storageId, line.itemBlueprintId)} className="text-primary hover:underline"
                                                            title="The moves that made this number" aria-label={`${formatNumber(line.amount)} ${label}: show the moves`}>
                                                            {formatNumber(line.amount)}
                                                        </Link>
                                                    </td>
                                                    <td className="py-1 pr-4">{formatNumber(line.storageWeight)}</td>
                                                    <td className="py-1 pr-4">{formatNumber(line.amount * line.storageWeight)}</td>
                                                    <td className="py-1 pr-4">{formatDateTime(line.updatedAt)}</td>
                                                    <td className="py-1">
                                                        <div className="flex gap-1">
                                                            <button type="button" className="btn-secondary text-xs" {...gateProps}
                                                                onClick={() => setAdjust({ blueprint: { id: line.itemBlueprintId, label } })}
                                                                aria-label={`Adjust ${label}`}>Adjust</button>
                                                            <button type="button" className="btn-secondary text-xs" {...gateProps}
                                                                onClick={() => setMoveBlueprint({ id: line.itemBlueprintId, label })}
                                                                aria-label={`Move ${label}`}>Move</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                    <h3 className="mb-2 mt-6 text-base font-semibold text-fg">Unique items</h3>
                    {units.length === 0
                        ? <p className="text-sm text-muted">No unique items.</p>
                        : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm" aria-label="Unique items">
                                    <thead>
                                        <tr className="text-left text-muted">
                                            <th className="py-1 pr-4 font-medium">Item instance</th>
                                            <th className="py-1 pr-4 font-medium">Blueprint</th>
                                            <th className="py-1 pr-4 font-medium">Name</th>
                                            <th className="py-1 pr-4 font-medium">Added</th>
                                            <th className="py-1 font-medium"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {units.map(unit => (
                                            <tr key={unit.id} className="border-t border-line">
                                                <td className="py-1 pr-4">
                                                    <Link to={itemInstanceMovesPath(unit.itemInstanceId)} className="text-primary hover:underline"
                                                        aria-label={`Item #${unit.itemInstanceId}: show its moves`}>#{unit.itemInstanceId}</Link>
                                                </td>
                                                <td className="py-1 pr-4">{unit.itemBlueprintName ?? `Blueprint #${unit.itemBlueprintId}`}</td>
                                                <td className="py-1 pr-4">{unit.customDisplayName ?? '-'}</td>
                                                <td className="py-1 pr-4">{formatDateTime(unit.addedAt)}</td>
                                                <td className="py-1">
                                                    <button type="button" className="btn-secondary text-xs" {...gateProps}
                                                        onClick={() => setAdjust({ itemInstanceId: unit.itemInstanceId })}
                                                        aria-label={`Take out item #${unit.itemInstanceId}`}>Take out</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    {economyGate.hint && <p className="mt-3 text-xs text-muted">Adjusting and moving stock: {economyGate.hint}.</p>}
                </>
            )}
            <StockAdjustDialog
                open={adjust !== null}
                storageId={storageId}
                storageName={name}
                preset={adjust}
                onClose={() => setAdjust(null)}
                onApplied={applied}
            />
            <StockMoveDialog
                open={moveBlueprint !== undefined}
                storage={self}
                blueprint={moveBlueprint ?? null}
                onClose={() => setMoveBlueprint(undefined)}
                onApplied={applied}
            />
        </section>
    );
};

export default StoragePanel;
