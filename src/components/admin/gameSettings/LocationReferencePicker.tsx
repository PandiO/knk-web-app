import React from 'react';
import { AlertTriangle, Check, ChevronDown, MapPin, Plus, Search, X } from 'lucide-react';
import { LocationReferenceDto, LocationReferenceSourceType } from '../../../types/dtos/gameSettings/GameSettingsModels';
import {
    LocationOption,
    cleanText,
    filterLocationOptions,
    formatPosition,
    searchWords,
    toReference,
} from './locationReferenceOptions';

/** Rows shown per type group; more = "type to narrow down". */
const MAX_PER_GROUP = 50;

type TypeFilter = LocationReferenceSourceType | 'All';

/** Group order in the list, and the filter chips. */
const GROUP_ORDER: LocationReferenceSourceType[] = ['Town', 'District', 'Structure', 'Location'];
const PLURAL: Record<LocationReferenceSourceType, string> = {
    Town: 'Towns',
    District: 'Districts',
    Structure: 'Structures',
    Location: 'Locations',
};
const BADGE: Record<LocationReferenceSourceType, string> = {
    Town: 'bg-amber-100 text-amber-800',
    District: 'bg-sky-100 text-sky-800',
    Structure: 'bg-violet-100 text-violet-800',
    Location: 'bg-emerald-100 text-emerald-800',
};

const TypeBadge: React.FC<{ type: LocationReferenceSourceType }> = ({ type }) => (
    <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${BADGE[type]}`}>
        {type}
    </span>
);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** {@code text} with every search word marked. */
const Highlight: React.FC<{ text: string; words: string[] }> = ({ text, words }) => {
    if (words.length === 0) {
        return <>{text}</>;
    }
    const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'ig');
    return (
        <>
            {text.split(pattern).map((part, i) =>
                i % 2 === 1 ? <mark key={i} className="rounded-sm bg-yellow-100 text-inherit">{part}</mark> : part)}
        </>
    );
};

/** "Cinix › Residential District · #12", or the position for a bare Location. */
const optionDetail = (option: LocationOption) => [
    option.parents.length > 0 ? option.parents.join(' › ') : formatPosition(option.location),
    `#${option.sourceId}`,
].join(' · ');

/**
 * The name part of a saved label ("District: Docks (Town: Kardenna) - world 1, 2, 3" -> "Docks (Town:
 * Kardenna)"), for a reference that no longer resolves; the coordinates show in the warning instead.
 */
const savedName = (value: LocationReferenceDto) =>
    cleanText(value.displayLabel)
        .replace(new RegExp(`^${value.sourceType}:\\s*`), '')
        .replace(/\s+-\s+\S+\s+-?[\d.]+,\s*-?[\d.]+,\s*-?[\d.]+$/, '');

/**
 * Picks a spawn point for the Game Settings page: a Location or a Town/District/Structure's default
 * spawn Location, found by id, name or parent domain (KNG-52, docs/specs/game-settings/DESIGN.md §3.2).
 * The choice shows as a card; "Change" opens a combobox panel with type chips, grouped results and a
 * "+ New Location..." action. Clicks inside the panel never blur the search box, so a pick can't be
 * lost to the list closing first.
 */
export const LocationReferencePicker: React.FC<{
    value: LocationReferenceDto | null;
    options: LocationOption[];
    onChange: (value: LocationReferenceDto | null) => void;
    onCreateLocation?: () => void;
    label?: string;
}> = ({ value, options, onChange, onCreateLocation, label }) => {
    const [open, setOpen] = React.useState(false);
    const [type, setType] = React.useState<TypeFilter>('All');
    const [query, setQuery] = React.useState('');
    const [activeKey, setActiveKey] = React.useState<string | null>(null);

    const rootRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const baseId = React.useId();
    const listId = `${baseId}-list`;
    const optionId = (key: string) => `${baseId}-opt-${key}`;

    const selected = value ? options.find(o => o.sourceType === value.sourceType && o.sourceId === value.sourceId) : undefined;
    const words = React.useMemo(() => searchWords(query), [query]);

    // Grouped and capped; `visible` is what the arrow keys walk through, in display order.
    const groups = React.useMemo(() => {
        const matches = filterLocationOptions(options, type, query);
        return GROUP_ORDER
            .map(groupType => {
                const all = matches.filter(o => o.sourceType === groupType);
                return { type: groupType, shown: all.slice(0, MAX_PER_GROUP), hidden: Math.max(0, all.length - MAX_PER_GROUP) };
            })
            .filter(g => g.shown.length > 0);
    }, [options, type, query]);
    const visible = React.useMemo(() => groups.flatMap(g => g.shown), [groups]);
    const active = visible.find(o => o.key === activeKey) ?? visible[0];

    const openPanel = () => {
        setQuery('');
        setActiveKey(selected?.key ?? null);
        setOpen(true);
    };
    const close = (refocus: boolean) => {
        setOpen(false);
        if (refocus) {
            // The trigger re-renders when the panel closes; focus it after that.
            setTimeout(() => triggerRef.current?.focus(), 0);
        }
    };
    const pick = (option: LocationOption) => {
        onChange(toReference(option));
        close(true);
    };

    React.useEffect(() => {
        if (open) {
            inputRef.current?.focus();
        }
    }, [open]);

    React.useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onDocumentMouseDown = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocumentMouseDown);
        return () => document.removeEventListener('mousedown', onDocumentMouseDown);
    }, [open]);

    // Keep the keyboard-active row in view.
    React.useEffect(() => {
        if (open && active) {
            const element = document.getElementById(optionId(active.key));
            element?.scrollIntoView?.({ block: 'nearest' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, active?.key]);

    const onTriggerKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPanel();
        }
    };

    const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const index = active ? visible.indexOf(active) : -1;
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (visible.length > 0) {
                    setActiveKey(visible[Math.min(visible.length - 1, index + 1)].key);
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (visible.length > 0) {
                    setActiveKey(visible[Math.max(0, index - 1)].key);
                }
                break;
            case 'Home':
            case 'End':
                if (visible.length > 0 && event.ctrlKey) {
                    event.preventDefault();
                    setActiveKey(visible[event.key === 'Home' ? 0 : visible.length - 1].key);
                }
                break;
            case 'Enter':
                event.preventDefault();
                if (active) {
                    pick(active);
                }
                break;
            case 'Escape':
                event.preventDefault();
                close(true);
                break;
        }
    };

    const chip = (filter: TypeFilter) => {
        const pressed = type === filter;
        return (
            <button
                key={filter}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                    setType(filter);
                    setActiveKey(null);
                }}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    pressed
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
                {filter === 'All' ? 'All' : PLURAL[filter]}
            </button>
        );
    };

    const triggerProps = {
        ref: triggerRef,
        type: 'button' as const,
        'aria-haspopup': 'listbox' as const,
        'aria-expanded': open,
        onClick: () => (open ? close(false) : openPanel()),
        onKeyDown: onTriggerKeyDown,
    };

    return (
        <div
            ref={rootRef}
            className="relative space-y-1"
            // Tabbing (or clicking) out of the picker closes the panel.
            onBlur={event => {
                if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) {
                    setOpen(false);
                }
            }}
        >
            {label && <p className="text-sm font-medium text-gray-700">{label}</p>}

            {value ? (
                <div
                    className={`flex items-start gap-2 rounded-md border bg-white p-2.5 ${
                        open ? 'border-primary ring-1 ring-primary' : 'border-gray-300'
                    }`}
                    data-testid="location-reference-selected"
                >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => (open ? close(false) : openPanel())}
                    >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <TypeBadge type={value.sourceType} />
                            <span className="min-w-0 truncate font-semibold text-gray-900">
                                {selected ? selected.name : savedName(value) || `${value.sourceType} #${value.sourceId}`}
                            </span>
                        </div>
                        {selected && selected.parents.length > 0 && (
                            <p className="mt-0.5 truncate text-sm text-gray-600">{selected.parents.join(' › ')}</p>
                        )}
                        {selected && <p className="mt-0.5 text-xs text-gray-500">{formatPosition(selected.location)}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button {...triggerProps} className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10">
                            Change
                        </button>
                        <button
                            type="button"
                            aria-label="Clear spawn point"
                            title="Clear"
                            onClick={() => onChange(null)}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    {...triggerProps}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border border-dashed bg-white px-3 py-2 text-left text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 ${
                        open ? 'border-primary ring-1 ring-primary' : 'border-gray-300'
                    }`}
                >
                    <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" aria-hidden />
                        Choose a spawn point
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
                </button>
            )}

            {value && !selected && (
                <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800" role="status">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                        This {value.sourceType.toLowerCase()} no longer exists or has no location - the saved coordinates are used
                        {value.location ? <>: <strong>{formatPosition(value.location)}</strong></> : ' (none saved)'}.
                    </span>
                </p>
            )}

            {open && (
                <div
                    className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                    // Keep focus in the search box for every click in the panel (rows, chips, headings,
                    // padding), so the input never blurs before a row's click lands.
                    onMouseDown={event => {
                        if (event.target !== inputRef.current) {
                            event.preventDefault();
                        }
                    }}
                >
                    <div className="space-y-2 border-b border-gray-100 p-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
                            <input
                                ref={inputRef}
                                type="text"
                                role="combobox"
                                aria-label="Search spawn points"
                                aria-expanded
                                aria-controls={listId}
                                aria-autocomplete="list"
                                aria-activedescendant={active ? optionId(active.key) : undefined}
                                autoComplete="off"
                                placeholder="Search by name, id or town/district..."
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    setActiveKey(null);
                                }}
                                onKeyDown={onInputKeyDown}
                                className="block w-full rounded-md border-gray-300 pl-8 text-sm focus:border-primary focus:ring-primary"
                            />
                        </div>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
                            {chip('All')}
                            {GROUP_ORDER.map(chip)}
                        </div>
                    </div>

                    <div id={listId} role="listbox" aria-label="Spawn points" className="max-h-72 overflow-y-auto py-1">
                        {groups.length === 0 && (
                            <p className="px-3 py-4 text-center text-sm text-gray-500">
                                {query.trim()
                                    ? <>No spawn points match &lsquo;{query.trim()}&rsquo;</>
                                    : `No ${type === 'All' ? 'spawn points' : PLURAL[type].toLowerCase()} with a location yet.`}
                            </p>
                        )}
                        {groups.map(group => (
                            <div key={group.type} role="group" aria-labelledby={`${baseId}-group-${group.type}`}>
                                <div
                                    id={`${baseId}-group-${group.type}`}
                                    className="sticky top-0 bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                                >
                                    {PLURAL[group.type]}
                                </div>
                                {group.shown.map(option => {
                                    const isActive = option.key === active?.key;
                                    const isCurrent = option.key === selected?.key;
                                    return (
                                        <div
                                            key={option.key}
                                            id={optionId(option.key)}
                                            role="option"
                                            aria-selected={isActive}
                                            onMouseEnter={() => setActiveKey(option.key)}
                                            onClick={() => pick(option)}
                                            className={`flex cursor-pointer items-start gap-2 px-3 py-1.5 ${isActive ? 'bg-primary/10' : ''}`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-semibold text-gray-900">
                                                    <Highlight text={option.name} words={words} />
                                                </div>
                                                <div className="truncate text-xs text-gray-500">
                                                    <Highlight text={optionDetail(option)} words={words} />
                                                </div>
                                            </div>
                                            {isCurrent && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="current" />}
                                        </div>
                                    );
                                })}
                                {group.hidden > 0 && (
                                    <p className="px-3 py-1 text-xs italic text-gray-500">
                                        {group.hidden} more {PLURAL[group.type].toLowerCase()} - type to narrow down.
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {onCreateLocation && (
                        <div className="border-t border-gray-100 p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onCreateLocation();
                                }}
                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-primary/10"
                            >
                                <Plus className="h-4 w-4" aria-hidden /> New Location...
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
