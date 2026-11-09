// The picker behind Select and Add on the entity detail page (PandiO/knk-workspace#188).
import React, { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '../Dialog';
import { Pager } from '../Pager';
import { lookupClient, LookupItemDto } from '../../apiClients/lookupClient';
import { apiRefusalReason } from '../../utils/apiRefusalReason';

export const PICKER_PAGE_SIZE = 10;
/** Typing pauses this long before the search runs. */
export const PICKER_SEARCH_DELAY_MS = 250;

export interface RelationshipPickerDialogProps {
    open: boolean;
    onClose: () => void;
    /** "Add a Street to Cinix", "Select the Parent category". */
    title: string;
    /** The type searched through `api/Lookup` (any area node may search it, #280 AM2). */
    relatedType: string;
    /** Its label, plural-free ("Street"). */
    relatedLabel: string;
    /** `lookupSearchable` from the related type's metadata; false: a message instead of the search. */
    searchable: boolean;
    /** Already linked: shown as "Linked", not pickable. */
    linkedIds: ReadonlySet<number>;
    /** "Add" or "Select". */
    actionLabel: string;
    /** Links the record; resolves when done (the page closes the dialog), rejects to stay open. */
    onPick: (item: LookupItemDto) => Promise<void>;
}

/**
 * A search box over the related type's lookup (id, name, one detail line) with paged results; each row has one
 * button. Search-as-you-type for the wizard's own relation fields is #191 (V6); this picker is the detail page's.
 */
export const RelationshipPickerDialog: React.FC<RelationshipPickerDialogProps> = ({
    open,
    onClose,
    title,
    relatedType,
    relatedLabel,
    searchable,
    linkedIds,
    actionLabel,
    onPick,
}) => {
    const [term, setTerm] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<{ items: LookupItemDto[]; total: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [picking, setPicking] = useState<number | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const searchId = useId();
    const statusId = useId();

    useEffect(() => {
        if (!open) return;
        setTerm('');
        setQuery('');
        setPage(1);
        setResult(null);
        setError(null);
        setPicking(null);
    }, [open, relatedType]);

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            setQuery(term.trim());
            setPage(1);
        }, PICKER_SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [term, open]);

    useEffect(() => {
        if (!open || !searchable) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        lookupClient.search(relatedType, query, page, PICKER_PAGE_SIZE)
            .then(answer => { if (!cancelled) setResult({ items: answer?.items ?? [], total: answer?.total ?? 0 }); })
            .catch(err => {
                if (cancelled) return;
                setResult(null);
                setError(apiRefusalReason(err) ?? `${relatedLabel} records couldn't be searched. Try again.`);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, searchable, relatedType, relatedLabel, query, page]);

    const pick = async (item: LookupItemDto) => {
        setPicking(item.id);
        try {
            await onPick(item);
        } catch {
            // The page has said why (a toast); the dialog stays open for another pick.
        } finally {
            setPicking(null);
        }
    };

    const busyLabel = actionLabel === 'Add' ? 'Adding…' : 'Selecting…';
    const total = result?.total ?? 0;
    const status = loading
        ? 'Searching…'
        : error ?? (result ? (total === 0 ? (query ? `No ${relatedLabel} matches "${query}".` : `There are no ${relatedLabel} records yet.`) : '') : '');

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            size="lg"
            dismissible={picking === null}
            initialFocusRef={searchRef as React.RefObject<HTMLElement>}
            footer={<button type="button" className="btn-secondary" onClick={onClose} disabled={picking !== null}>Close</button>}
            data-testid="relationship-picker"
        >
            {!searchable ? (
                <p className="text-sm text-muted" role="status">
                    {relatedLabel} records can't be searched here. Open the {relatedLabel} on its own page, or use Edit.
                </p>
            ) : (
                <div className="space-y-3">
                    <label htmlFor={searchId} className="block text-sm font-medium text-fg">Search {relatedLabel}</label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                        <input
                            id={searchId}
                            ref={searchRef}
                            type="search"
                            value={term}
                            onChange={event => setTerm(event.target.value)}
                            placeholder="Name…"
                            aria-describedby={statusId}
                            className="w-full rounded-md border border-line bg-surface py-2 pl-9 pr-3 text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <p id={statusId} role="status" aria-live="polite" className={error ? 'text-sm text-danger' : 'text-sm text-muted'}>
                        {status}
                    </p>
                    {result && result.items.length > 0 && (
                        <ul className="divide-y divide-line rounded-md border border-line" aria-label={`${relatedLabel} results`}>
                            {result.items.map(item => {
                                const linked = linkedIds.has(item.id);
                                return (
                                    <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-fg">{item.label}</p>
                                            {item.detail && <p className="truncate text-xs text-muted">{item.detail}</p>}
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-secondary flex-shrink-0 text-sm"
                                            disabled={linked || picking !== null}
                                            onClick={() => void pick(item)}
                                            aria-label={linked ? `${item.label} is linked` : `${actionLabel} ${item.label}`}
                                        >
                                            {linked ? 'Linked' : picking === item.id ? busyLabel : actionLabel}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {total > PICKER_PAGE_SIZE && (
                        <Pager
                            page={page}
                            pageSize={PICKER_PAGE_SIZE}
                            totalCount={total}
                            onPageChange={setPage}
                            disabled={loading}
                            label={`${relatedLabel} result pages`}
                            noun="records"
                            className="rounded-md border border-line"
                        />
                    )}
                </div>
            )}
        </Dialog>
    );
};

export default RelationshipPickerDialog;
