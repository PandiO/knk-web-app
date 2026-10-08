import React from 'react';
import { Search } from 'lucide-react';
import { LocationReferenceDto, LocationReferenceSourceType } from '../../../types/dtos/gameSettings/GameSettingsModels';
import { LocationOption, SOURCE_TYPES, filterLocationOptions, toReference } from './locationReferenceOptions';

const MAX_RESULTS = 50;

/**
 * Picks a spawn point for the Game Settings page: a Location or a Town/District/Structure's default
 * spawn Location, found by id, name or parent domain (KNG-52, docs/specs/game-settings/DESIGN.md §3.2).
 */
export const LocationReferencePicker: React.FC<{
    value: LocationReferenceDto | null;
    options: LocationOption[];
    onChange: (value: LocationReferenceDto | null) => void;
    onCreateLocation?: () => void;
    label?: string;
}> = ({ value, options, onChange, onCreateLocation, label }) => {
    const [type, setType] = React.useState<LocationReferenceSourceType | 'All'>('All');
    const [query, setQuery] = React.useState('');
    const [open, setOpen] = React.useState(false);

    const matches = React.useMemo(() => filterLocationOptions(options, type, query), [options, type, query]);
    const selected = value ? options.find(o => o.sourceType === value.sourceType && o.sourceId === value.sourceId) : undefined;

    return (
        <div className="space-y-2 rounded-md border border-gray-200 p-3">
            {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
            <div className="text-sm">
                {value ? (
                    <span className="text-gray-900" data-testid="location-reference-selected">
                        {selected?.displayLabel || value.displayLabel || `${value.sourceType} #${value.sourceId}`}
                        {!selected && <span className="ml-2 text-xs text-amber-700">(not found any more - the saved coordinates are used)</span>}
                    </span>
                ) : (
                    <span className="text-gray-500">Nothing selected</span>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                <select
                    aria-label="Spawn point type"
                    value={type}
                    onChange={e => setType(e.target.value as LocationReferenceSourceType | 'All')}
                    className="rounded-md border-gray-300 text-sm focus:border-primary focus:ring-primary"
                >
                    <option value="All">All types</option>
                    {SOURCE_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
                <div className="relative flex-1 min-w-[14rem]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="search"
                        aria-label="Search spawn points"
                        placeholder="Search by id, name or parent (town, district)..."
                        value={query}
                        onFocus={() => setOpen(true)}
                        onChange={e => {
                            setQuery(e.target.value);
                            setOpen(true);
                        }}
                        className="block w-full rounded-md border-gray-300 pl-8 text-sm focus:border-primary focus:ring-primary"
                    />
                </div>
            </div>

            {open && (
                <ul className="max-h-60 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100" role="listbox">
                    {matches.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No matching spawn points.</li>}
                    {matches.slice(0, MAX_RESULTS).map(option => (
                        <li key={option.key}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={selected?.key === option.key}
                                onClick={() => {
                                    onChange(toReference(option));
                                    setOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${selected?.key === option.key ? 'bg-primary/10' : ''}`}
                            >
                                <span className="font-medium text-gray-900">{option.sourceType} #{option.sourceId}: {option.name}</span>
                                {option.parentLabel && <span className="ml-2 text-gray-500">{option.parentLabel}</span>}
                                <span className="block text-xs text-gray-500">
                                    {option.location.world} {option.location.x}, {option.location.y}, {option.location.z}
                                </span>
                            </button>
                        </li>
                    ))}
                    {matches.length > MAX_RESULTS && (
                        <li className="px-3 py-2 text-xs text-gray-500">{matches.length - MAX_RESULTS} more - refine the search.</li>
                    )}
                </ul>
            )}

            <div className="flex flex-wrap gap-2">
                {open && (
                    <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(false)}>Close list</button>
                )}
                {onCreateLocation && (
                    <button type="button" className="btn-secondary text-xs" onClick={onCreateLocation}>
                        Create a Location via Form Wizard
                    </button>
                )}
                {value && (
                    <button type="button" className="btn-secondary text-xs" onClick={() => onChange(null)}>Clear</button>
                )}
            </div>

            {value?.location && (
                <p className="text-xs text-gray-600">
                    Saved position: {value.location.world} {value.location.x}, {value.location.y}, {value.location.z}
                </p>
            )}
        </div>
    );
};
