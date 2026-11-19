import React, { useEffect, useId, useState } from 'react';
import { lookupClient, LookupItemDto } from '../../apiClients/lookupClient';

export interface LookupPick {
    id: number;
    label: string;
}

interface Props {
    /** The dashboard type searched through `api/Lookup/{type}` (ItemBlueprint, Storage). */
    entityType: string;
    label: string;
    value: LookupPick | null;
    onChange: (value: LookupPick | null) => void;
    disabled?: boolean;
    /** Ids not to offer (the move's other storage). */
    excludeIds?: number[];
    required?: boolean;
}

/**
 * A small search-and-pick field for the stock dialogs (PandiO/knk-workspace#675): type part of a name, pick one of the
 * matches from `api/Lookup/{type}`. Picked: the name with a Change button.
 */
export const LookupPicker: React.FC<Props> = ({ entityType, label, value, onChange, disabled = false, excludeIds, required = false }) => {
    const id = useId();
    const [term, setTerm] = useState('');
    const [items, setItems] = useState<LookupItemDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (value || term.trim().length === 0) {
            setItems([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const result = await lookupClient.search(entityType, term, 1, 10);
                if (!cancelled) {
                    setItems(result?.items ?? []);
                    setError(null);
                }
            } catch {
                if (!cancelled) setError(`Couldn't search ${label.toLowerCase()}.`);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [entityType, label, term, value]);

    if (value) {
        return (
            <div>
                <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-fg" data-testid={`${id}-picked`}>{value.label} (#{value.id})</span>
                    <button type="button" className="btn-secondary text-xs" disabled={disabled} onClick={() => { onChange(null); setTerm(''); }}>
                        Change {label.toLowerCase()}
                    </button>
                </div>
            </div>
        );
    }

    const shown = items.filter(item => !excludeIds?.includes(item.id));
    return (
        <div>
            <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg">{label}{required ? ' *' : ''}</label>
            <input
                id={id}
                type="search"
                className="input w-full px-3 py-2"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={term}
                disabled={disabled}
                onChange={e => setTerm(e.target.value)}
                autoComplete="off"
            />
            {error && <p className="mt-1 text-xs field-error">{error}</p>}
            {searching && <p className="mt-1 text-xs text-muted">Searching…</p>}
            {shown.length > 0 && (
                <ul className="mt-1 max-h-48 overflow-auto rounded border border-line" aria-label={`${label} matches`}>
                    {shown.map(item => (
                        <li key={item.id}>
                            <button
                                type="button"
                                className="w-full px-3 py-1 text-left text-sm hover:bg-surface-alt"
                                onClick={() => onChange({ id: item.id, label: item.label })}
                            >
                                {item.label}{item.detail ? ` · ${item.detail}` : ''}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LookupPicker;
