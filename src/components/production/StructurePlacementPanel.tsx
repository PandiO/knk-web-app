import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, MapPinned } from 'lucide-react';
import { warehouseClient } from '../../apiClients/warehouseClient';
import { productionStructureClient } from '../../apiClients/productionStructureClient';
import { ProductionStructureDto, WarehouseDto } from '../../types/dtos/structure/ProductionWorldDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { displayPath } from '../../utils/returnTo';
import { formatDateTime } from '../../utils/format';
import { effectiveTownId, isRuralStructure, roadConnectionLabel } from '../../utils/productionWorld';

interface Props {
    /** `warehouse` or `productionstructure` (case-insensitive). */
    entityTypeName: string;
    structureId: number;
    /** This page, so a linked page comes back here. */
    returnTo: string | null;
    /** Changes when the details above were re-read (a save elsewhere on the page). */
    refreshKey?: number;
}

type Loaded = { kind: 'warehouse'; dto: WarehouseDto } | { kind: 'production'; dto: ProductionStructureDto };

/**
 * Where a warehouse or production structure stands and what needs attention (PandiO/knk-workspace#676; production
 * DESIGN § 3.3-3.4, decisions R1-R3, acceptance A06-A07): in a district (with its address) or rural in its town's
 * territory, the effective town, and for a production structure the dashboard warnings (contested land, outside its
 * town's territory, not connected to its town's roads), the road connection, workers and delivery preference. A flagged
 * structure keeps its town and keeps producing; the warning is for staff.
 */
export const StructurePlacementPanel: React.FC<Props> = ({ entityTypeName, structureId, returnTo, refreshKey }) => {
    const isWarehouse = entityTypeName.toLowerCase() === 'warehouse';
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setLoaded(isWarehouse
                ? { kind: 'warehouse', dto: await warehouseClient.getById(structureId) }
                : { kind: 'production', dto: await productionStructureClient.getById(structureId) });
        } catch (err) {
            setError(apiRefusalReason(err) ?? "Couldn't load the placement.");
        }
    }, [isWarehouse, structureId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const dto = loaded?.dto;
    const rural = dto ? isRuralStructure(dto) : false;
    const townId = dto ? effectiveTownId(dto) : null;
    const townName = dto ? (rural ? dto.town?.name : dto.district?.townName) : null;
    const production = loaded?.kind === 'production' ? loaded.dto : null;
    const warehouse = loaded?.kind === 'warehouse' ? loaded.dto : null;
    const warnings = production?.warnings ?? [];
    const houseNumber = dto?.houseNumber ?? 0;

    return (
        <section className="panel mt-6 p-4 sm:p-6" aria-labelledby="structure-placement-heading" data-testid="structure-placement">
            <h2 id="structure-placement-heading" className="mb-4 flex items-center text-lg font-semibold text-fg">
                <MapPinned className="mr-2 h-5 w-5" aria-hidden="true" />
                Placement
            </h2>
            {error && <p className="text-sm field-error" role="alert">{error}</p>}
            {!error && !dto && <p className="text-sm text-muted">Loading the placement…</p>}
            {dto && (
                <>
                    {production && (
                        warnings.length > 0 ? (
                            <div className="mb-4 rounded-md border border-warning-line bg-warning-muted px-4 py-3 text-sm text-warning-strong">
                                <p className="flex items-center font-semibold">
                                    <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />Warnings
                                </p>
                                <ul aria-label="Warnings" className="mt-1 list-disc pl-6">
                                    {warnings.map(warning => <li key={warning}>{warning}</li>)}
                                </ul>
                            </div>
                        ) : (
                            <p className="mb-4 text-sm text-muted" data-testid="structure-no-warnings">No warnings.</p>
                        )
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-muted">Placement</dt>
                            <dd className="text-fg" data-testid="structure-placement-kind">
                                {rural
                                    ? "Rural, in its town's territory (no district or street)"
                                    : <>
                                        {'In district '}
                                        {dto.districtId
                                            ? <Link to={displayPath('District', dto.districtId, returnTo)} className="text-primary hover:underline">{dto.district?.name ?? `District #${dto.districtId}`}</Link>
                                            : '-'}
                                        {dto.street?.name ? `, ${dto.street.name}${houseNumber > 0 ? ` ${houseNumber}` : ''}` : ''}
                                    </>}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Town</dt>
                            <dd className="text-fg" data-testid="structure-effective-town">
                                {townId != null
                                    ? <Link to={displayPath('Town', townId, returnTo)} className="text-primary hover:underline">{townName ?? `Town #${townId}`}</Link>
                                    : 'None'}
                                {townId != null && !rural ? ' (through its district)' : ''}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted">Region</dt>
                            <dd className="text-fg">{dto.wgRegionId || '-'}{dto.worldName ? ` (${dto.worldName})` : ''}</dd>
                        </div>
                        {production && (
                            <>
                                <div>
                                    <dt className="text-muted">Road connection</dt>
                                    <dd className={production.roadConnection === 'Unconnected' && rural ? 'font-medium text-warning-strong' : 'text-fg'} data-testid="structure-road-connection">
                                        {rural ? roadConnectionLabel(production.roadConnection) : 'In a district: uses its town\'s roads'}
                                        {rural && production.roadConnectionMeasuredAt ? ` (measured ${formatDateTime(production.roadConnectionMeasuredAt)})` : ''}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted">Production</dt>
                                    <dd className="text-fg" data-testid="structure-production">
                                        {production.productionEnabled === false ? 'Off' : 'On'}, level {production.level ?? 1}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted">Workers present</dt>
                                    <dd className="text-fg" data-testid="structure-workers">
                                        {production.workersPresent ?? 0} of {production.workersTotal ?? 0}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted">Delivers to</dt>
                                    <dd className="text-fg" data-testid="structure-delivers-to">
                                        {production.warehousePreference === 'Preferred' && production.preferredWarehouseId
                                            ? <Link to={displayPath('Warehouse', production.preferredWarehouseId, returnTo)} className="text-primary hover:underline">
                                                {production.preferredWarehouse?.name ?? `Warehouse #${production.preferredWarehouseId}`}
                                            </Link>
                                            : 'The nearest warehouse of its town that accepts deliveries'}
                                    </dd>
                                </div>
                            </>
                        )}
                        {warehouse && (
                            <>
                                <div>
                                    <dt className="text-muted">Deliveries</dt>
                                    <dd className="text-fg" data-testid="warehouse-deliveries">
                                        {warehouse.acceptsDeliveries === false ? 'Does not accept deliveries' : 'Accepts deliveries'}, priority {warehouse.priority ?? 0}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted">Delivery storage</dt>
                                    <dd className="text-fg">
                                        {warehouse.defaultStorageId
                                            ? <Link to={displayPath('Storage', warehouse.defaultStorageId, returnTo)} className="text-primary hover:underline">
                                                {warehouse.storages?.find(s => s.id === warehouse.defaultStorageId)?.name ?? `Storage #${warehouse.defaultStorageId}`}
                                            </Link>
                                            : 'None'}
                                    </dd>
                                </div>
                            </>
                        )}
                    </dl>
                </>
            )}
        </section>
    );
};

export default StructurePlacementPanel;
