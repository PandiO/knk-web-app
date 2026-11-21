import React from 'react';
import { Link } from 'react-router-dom';
import { ServiceAreaEntryDto } from '../../types/dtos/production/LogisticsDtos';
import { displayPath } from '../../utils/returnTo';

interface Props {
    entries: ServiceAreaEntryDto[];
    returnTo: string | null;
    label: string;
}

/** An area in words: the district's name, "The rural territory", or the structure's name. */
export function serviceAreaName(entry: ServiceAreaEntryDto): string {
    if (entry.areaKind === 'District') return `District ${entry.districtName ?? `#${entry.districtId}`}`;
    if (entry.areaKind === 'Rural') return 'The rural territory';
    return entry.structureName ?? `Structure #${entry.structureId}`;
}

/**
 * Which warehouse serves each district, the rural territory and each producer and consumer (PandiO/knk-workspace#686;
 * TOWN_LOGISTICS § 2, § 4): from a ServiceArea rule, or the nearest by road.
 */
export const ServiceAreaTable: React.FC<Props> = ({ entries, returnTo, label }) => {
    if (entries.length === 0) return <p className="text-sm text-muted">No districts, rural territory or structures to serve.</p>;
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label={label}>
                <thead>
                    <tr className="text-muted">
                        <th className="pr-4 font-medium">Area</th><th className="pr-4 font-medium">Served by</th><th className="font-medium">Why</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(entry => (
                        <tr key={`${entry.areaKind}-${entry.districtId ?? ''}-${entry.structureId ?? ''}`} className="border-t border-line">
                            <td className="pr-4 py-1">
                                {entry.areaKind === 'Structure' && entry.structureId != null
                                    ? <Link to={displayPath('Structure', entry.structureId, returnTo)} className="text-primary hover:underline">{serviceAreaName(entry)}</Link>
                                    : serviceAreaName(entry)}
                            </td>
                            <td className="pr-4 py-1">
                                {entry.warehouseId != null
                                    ? <Link to={displayPath('Warehouse', entry.warehouseId, returnTo)} className="text-primary hover:underline">{entry.warehouseName ?? `#${entry.warehouseId}`}</Link>
                                    : 'No warehouse'}
                            </td>
                            <td className="py-1">{entry.source === 'Rule' ? `Service area rule${entry.ruleId != null ? ` #${entry.ruleId}` : ''}` : 'Nearest by road'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ServiceAreaTable;
