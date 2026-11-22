import React from 'react';
import { domainTypeLabel } from '../../utils/landmarks';

/** Landmark-domain A07 (PandiO/knk-workspace#986): entities whose table offers a Type filter (the API's `domainType`). */
export const DOMAIN_TYPE_FILTER_ENTITIES: ReadonlySet<string> = new Set(['domain']);
export const DOMAIN_TYPE_FILTER_KEY = 'domainType';

/** The concrete domain types of knk-web-api, as `POST api/Domains/search` names them (exact types: Structure is not Gate). */
export const DOMAIN_TYPES = [
    'Town', 'District', 'Structure', 'GateStructure', 'Warehouse', 'ProductionStructure', 'CrownLand', 'Landmark',
] as const;

interface DomainTypeFilterSelectProps {
    /** The chosen type, or undefined for every domain. */
    value?: string;
    onChange: (domainType: string | undefined) => void;
}

/** "Type" filter for domain tables and pickers (landmark-domain LD20): one domain type, or all of them. */
export const DomainTypeFilterSelect: React.FC<DomainTypeFilterSelectProps> = ({ value, onChange }) => (
    <select
        aria-label="Domain type filter"
        value={value ?? ''}
        onChange={event => onChange(event.target.value || undefined)}
        title="Only domains of this type"
        className="block rounded-md border-field shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
    >
        <option value="">All types</option>
        {DOMAIN_TYPES.map(type => (
            <option key={type} value={type}>{domainTypeLabel(type)}</option>
        ))}
    </select>
);
