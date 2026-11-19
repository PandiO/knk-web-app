import React from 'react';
import { territoryFlagLabel } from '../../utils/territory';

/** P2 (PandiO/knk-workspace#676): entities whose table offers a Territory flag filter (the API's `territoryFlag`). */
export const TERRITORY_FLAG_FILTER_ENTITIES: ReadonlySet<string> = new Set(['structure', 'warehouse', 'productionstructure']);
export const TERRITORY_FLAG_FILTER_KEY = 'territoryFlag';

const FLAGS = ['Contested', 'OutsideTerritory'] as const;

interface TerritoryFlagFilterSelectProps {
    /** The chosen flag, or undefined for every structure. */
    value?: string;
    onChange: (flag: string | undefined) => void;
}

/**
 * "Territory flag" filter for structure tables (production DESIGN § 3.4, territory DESIGN § 4, A07): the structures the
 * game server's territory report flagged, because their land is contested or outside their town's territory. They keep
 * their town and keep producing; the flag is a warning for staff.
 */
export const TerritoryFlagFilterSelect: React.FC<TerritoryFlagFilterSelectProps> = ({ value, onChange }) => (
    <select
        aria-label="Territory flag filter"
        value={value ?? ''}
        onChange={event => onChange(event.target.value || undefined)}
        title="Structures the territory report flagged"
        className="block rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
    >
        <option value="">All structures</option>
        {FLAGS.map(flag => (
            <option key={flag} value={flag}>{`Flagged: ${territoryFlagLabel(flag).toLowerCase()}`}</option>
        ))}
    </select>
);
