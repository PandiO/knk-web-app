// The form wizard's relation picker: search as you type, "Open full table" as the fallback (PandiO/knk-workspace#191).
import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Check, Loader2, PlusCircle, Search, Table2 } from 'lucide-react';
import { Dialog } from '../Dialog';
import { PagedEntityTable } from '../PagedEntityTable/PagedEntityTable';
import { getColumnDefinitions } from '../../config/objectConfigs';
import { getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { lookupClient } from '../../apiClients/lookupClient';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { usePermissions } from '../../hooks/useStaffAccess';
import { metadataFor } from '../DisplayWizard/detailPage';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { entityTypeFallbackLabel } from '../../utils/entityLabel';
import { formatNumber } from '../../utils/format';
import { buildPinnedSection, isSameSelection, PinnedRow, tableRowKey } from '../../utils/forms/sessionPinnedRows';
import {
    lookupFilterPlan, lookupItemToValue, optionDetail, relationAccess, RelationAccess, RELATION_PICKER_DELAY_MS,
    RELATION_PICKER_PAGE_SIZE,
} from '../../utils/forms/relationPicker';
import { EntityMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { ColumnDefinition } from '../../types/common';

type Row = Record<string, any>;

export interface RelationPickerProps {
    /** The related type (`field.objectType`). */
    entityTypeName: string;
    /** The search box's accessible name, e.g. "Select Street" or "Add Districts". */
    label: string;
    placeholder?: string;
    /** `single`: a pick replaces the value. `multiple`: a pick adds or removes one row. */
    mode: 'single' | 'multiple';
    selected: Row[];
    onChange: (selected: Row[]) => void;
    min?: number;
    max?: number;
    /** The field's resolved pickerFilters (utils/forms/pickerFilters.ts). */
    filters?: Record<string, string>;
    /** KNG-136: rows this form session created, offered first ("Created in this form"). */
    pinnedRows?: Array<PinnedRow<Row>>;
    /** Changes when a pinned row is registered or edited: the open search runs again. */
    refreshKey?: string;
}

const pickedName = (row: Row): string =>
    String(row.name ?? row.Name ?? row.displayName ?? row.DisplayName ?? row.resolvedName ?? row.username ?? row.label
        ?? (row.id != null ? `#${row.id}` : 'Unnamed'));

/**
 * A combobox over the related type: typing pauses 250 ms, then the first 8 matches show under the box, with the rows
 * this form created on top. Enter or a click picks; Escape closes the list (not the dialog around it). With a read node
 * of the type it uses the type's own search and offers "Open full table" (the old inline table, with its filters and
 * columns, in a dialog); without one it searches `api/Lookup` (names only, #280). Nothing is fetched until the box is
 * used, and the permission and metadata checks also wait for that.
 */
export const RelationPicker: React.FC<RelationPickerProps> = props => {
    const { label, placeholder, mode, selected } = props;
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [activeId, setActiveId] = useState<string | undefined>(undefined);
    const [tableOpen, setTableOpen] = useState(false);
    const panel = useRef<PanelHandle>(null);
    const container = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const listboxId = useId();
    const inputId = useId();

    const close = useCallback(() => {
        setOpen(false);
        setActiveId(undefined);
    }, []);

    const afterPick = useCallback(() => {
        if (mode === 'single') {
            setTerm('');
            close();
        }
    }, [mode, close]);

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                if (!open) setOpen(true);
                else panel.current?.move(event.key === 'ArrowDown' ? 1 : -1);
                break;
            case 'Enter':
                if (open && panel.current?.pickActive()) event.preventDefault();
                break;
            case 'Escape':
                if (open) {
                    // Only the list closes; the dialog around the form stays (Dialog skips handled Escapes).
                    event.preventDefault();
                    close();
                }
                break;
            default:
                break;
        }
    };

    return (
        <div
            ref={container}
            className="relative"
            onBlur={event => {
                const next = event.relatedTarget as Node | null;
                if (!next || !container.current?.contains(next)) close();
            }}
            data-testid="relation-picker"
        >
            <label htmlFor={inputId} className="sr-only">{label}</label>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                    ref={input}
                    id={inputId}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={open ? activeId : undefined}
                    autoComplete="off"
                    value={term}
                    placeholder={placeholder ?? 'Search…'}
                    onChange={event => {
                        setTerm(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onClick={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    className="w-full rounded-md border border-line bg-surface py-2 pl-9 pr-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>
            {open && (
                <RelationPickerPanel
                    ref={panel}
                    {...props}
                    term={term}
                    listboxId={listboxId}
                    selected={selected}
                    onActiveChange={setActiveId}
                    onPicked={afterPick}
                    onOpenTable={() => {
                        close();
                        setTableOpen(true);
                    }}
                />
            )}
            {tableOpen && (
                <FullTableDialog
                    {...props}
                    onClose={() => {
                        setTableOpen(false);
                        input.current?.focus();
                    }}
                />
            )}
        </div>
    );
};

interface PanelHandle {
    move: (delta: number) => void;
    /** Picks the highlighted option; false when none is highlighted. */
    pickActive: () => boolean;
}

interface PanelProps extends RelationPickerProps {
    term: string;
    listboxId: string;
    onActiveChange: (id: string | undefined) => void;
    onPicked: () => void;
    onOpenTable: () => void;
}

interface Option {
    key: string;
    row: Row;
    badge?: string;
    detail?: string;
}

type Answer = { items: Row[]; total: number; details: Map<string, string> };

/**
 * The open list, mounted only while the list is open. The type's metadata says which nodes read it in full; without
 * any (an API before #280) the full search is used and no permission is asked.
 */
const RelationPickerPanel = forwardRef<PanelHandle, PanelProps>(function RelationPickerPanel(props, ref) {
    const { baseMetadata } = useEntityMetadata();
    const meta = metadataFor(baseMetadata, props.entityTypeName);
    const readNodes = useMemo(() => (meta?.readNodes ?? []).filter(Boolean), [meta]);
    return readNodes.length === 0
        ? <ResultsPanel ref={ref} {...props} meta={meta} access={FULL} />
        : <GatedResultsPanel ref={ref} {...props} meta={meta} readNodes={readNodes} />;
});

const FULL: RelationAccess = { mode: 'full' };

type ResultsProps = PanelProps & { meta: EntityMetadataDto | undefined };

/** Asks for the read nodes, then searches the way they allow (#280). */
const GatedResultsPanel = forwardRef<PanelHandle, ResultsProps & { readNodes: string[] }>(function GatedResultsPanel(
    { readNodes, ...props }, ref
) {
    const statuses = usePermissions(readNodes);
    return <ResultsPanel ref={ref} {...props} access={relationAccess(props.meta, statuses)} />;
});

/** Access known: the debounced search and the options. */
const ResultsPanel = forwardRef<PanelHandle, ResultsProps & { access: RelationAccess }>(function ResultsPanel({
    entityTypeName, mode, selected, onChange, max, filters, pinnedRows, refreshKey, term, listboxId,
    onActiveChange, onPicked, onOpenTable, meta, access,
}, ref) {
    const typeLabel = meta?.displayName || entityTypeFallbackLabel(entityTypeName);
    const filtersKey = JSON.stringify(filters ?? {});
    const plan = useMemo(() => lookupFilterPlan(filters), [filters]);
    const blockedFilters = access.mode === 'lookup' ? plan.unsupported : [];

    const columns = useMemo<ColumnDefinition<Row>[]>(() => {
        const configured = meta?.defaultTableColumns;
        if (configured && configured.length > 0) {
            const known = getColumnDefinitions(entityTypeName);
            return configured.map(key => known.find(c => c.key.toLowerCase() === key.toLowerCase())
                ?? { key, label: entityTypeFallbackLabel(key) });
        }
        return getColumnDefinitions(entityTypeName);
    }, [meta, entityTypeName]);

    // Typing pauses before the search; the first search runs at once.
    const [query, setQuery] = useState(term.trim());
    useEffect(() => {
        const next = term.trim();
        if (next === query) return undefined;
        const timer = setTimeout(() => setQuery(next), RELATION_PICKER_DELAY_MS);
        return () => clearTimeout(timer);
    }, [term, query]);

    const [answer, setAnswer] = useState<Answer | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canSearch = (access.mode === 'full' || access.mode === 'lookup') && blockedFilters.length === 0;

    useEffect(() => {
        if (!canSearch) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        const run = async (): Promise<Answer> => {
            if (access.mode === 'full') {
                const page = await getSearchFunctionForEntity(entityTypeName)({
                    page: 1, pageSize: RELATION_PICKER_PAGE_SIZE, searchTerm: query, sortBy: undefined, sortDescending: false,
                    filters: JSON.parse(filtersKey),
                });
                return { items: page?.items ?? [], total: page?.totalCount ?? 0, details: new Map() };
            }
            const page = await lookupClient.search(entityTypeName, query, 1, RELATION_PICKER_PAGE_SIZE);
            const details = new Map<string, string>();
            const items = (page?.items ?? [])
                .filter(item => !plan.excludeIds.has(String(item.id)))
                .map(item => {
                    if (item.detail) details.set(String(item.id), item.detail);
                    return lookupItemToValue(item) as Row;
                });
            return { items, total: page?.total ?? items.length, details };
        };
        run()
            .then(result => { if (!cancelled) setAnswer(result); })
            .catch(err => {
                if (cancelled) return;
                setAnswer(null);
                setError(apiRefusalReason(err) ?? `${typeLabel} records couldn't be searched. Try again.`);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // plan follows filtersKey; typeLabel only words the error.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSearch, access.mode, entityTypeName, query, filtersKey, refreshKey]);

    const options = useMemo<Option[]>(() => {
        const section = buildPinnedSection(pinnedRows, answer?.items ?? [], query, filters);
        const pinned = section.pinned.map((pin, index) => ({
            key: `p:${pin.key ?? tableRowKey(pin.row, entityTypeName, index)}`,
            row: pin.row,
            badge: pin.badge ?? 'New',
            detail: access.mode === 'full' ? optionDetail(pin.row, columns) : undefined,
        }));
        const rows = section.pageItems.map((row, index) => ({
            key: `r:${tableRowKey(row, entityTypeName, index)}`,
            row,
            detail: access.mode === 'full'
                ? optionDetail(row, columns)
                : answer?.details.get(String(row.id)),
        }));
        return [...pinned, ...rows];
        // filters follow filtersKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinnedRows, answer, query, filtersKey, entityTypeName, access.mode, columns]);

    const isSelected = useCallback(
        (row: Row) => selected.some(item => item && isSameSelection(item, row, entityTypeName)),
        [selected, entityTypeName]
    );
    const full = mode === 'multiple' && max != null && max > 0 && selected.length >= max;

    const [active, setActive] = useState(-1);
    useEffect(() => setActive(-1), [answer, query]);
    const optionId = (index: number) => `${listboxId}-o${index}`;
    useEffect(() => {
        onActiveChange(active >= 0 && active < options.length ? optionId(active) : undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, options.length]);
    useEffect(() => {
        if (active < 0) return;
        document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const pick = (row: Row) => {
        if (mode === 'single') {
            onChange([row]);
            onPicked();
            return;
        }
        if (isSelected(row)) {
            onChange(selected.filter(item => !isSameSelection(item, row, entityTypeName)));
        } else if (!full) {
            onChange([...selected, row]);
        }
        onPicked();
    };

    useImperativeHandle(ref, () => ({
        move: delta => {
            if (options.length === 0) return;
            setActive(previous => {
                const start = previous < 0 ? (delta > 0 ? -1 : 0) : previous;
                return (start + delta + options.length) % options.length;
            });
        },
        pickActive: () => {
            const option = options[active];
            if (!option) return false;
            pick(option.row);
            return true;
        },
    }));

    const nodesText = access.mode === 'lookup' || access.mode === 'none' ? access.nodes.join(', ') : '';
    const total = answer?.total ?? 0;
    const pageCount = answer?.items.length ?? 0;
    let status = '';
    if (access.mode === 'checking') status = 'Checking access…';
    else if (access.mode === 'none') status = `${typeLabel} records can't be searched here. Requires one of: ${nodesText}.`;
    else if (blockedFilters.length > 0) {
        status = `This list is narrowed by ${blockedFilters.join(', ')}, which only the full ${typeLabel} search can do. Requires one of: ${nodesText}.`;
    } else if (loading && !answer) status = 'Searching…';
    else if (error) status = error;
    else if (answer && options.length === 0) {
        status = query ? `No ${typeLabel} matches "${query}".` : `There are no ${typeLabel} records yet.`;
    } else if (answer && total > pageCount) {
        status = `${formatNumber(pageCount)} of ${formatNumber(total)} shown. Keep typing to narrow it down${access.mode === 'full' ? ', or open the full table' : ''}.`;
    }

    // Once the first answer is in, bring the list into view; the bottom scroll margin clears the wizard's sticky footer
    // (tall on phones), so the list doesn't open behind it.
    const root = useRef<HTMLDivElement>(null);
    const shown = useRef(false);
    useEffect(() => {
        if (shown.current || (!answer && !error)) return;
        shown.current = true;
        root.current?.scrollIntoView?.({ block: 'nearest' });
    }, [answer, error]);

    const pinnedCount = options.filter(option => option.badge).length;
    const statusClass = error || access.mode === 'none' || blockedFilters.length > 0 ? 'text-danger' : 'text-muted';

    return (
        <div ref={root} className="mt-1 scroll-mb-64 rounded-md border border-line bg-surface shadow-sm sm:scroll-mb-28" data-testid="relation-picker-panel">
            {options.length > 0 && (
                <ul
                    id={listboxId}
                    role="listbox"
                    aria-label={`${typeLabel} results`}
                    aria-multiselectable={mode === 'multiple' || undefined}
                    className="max-h-72 overflow-y-auto py-1"
                >
                    {options.map((option, index) => {
                        const chosen = isSelected(option.row);
                        const disabled = full && !chosen;
                        return (
                            <React.Fragment key={option.key}>
                                {index === 0 && pinnedCount > 0 && (
                                    <li role="presentation" className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                                        Created in this form
                                    </li>
                                )}
                                {index === pinnedCount && pinnedCount > 0 && index < options.length && (
                                    <li role="presentation" className="mx-3 my-1 border-t border-line" />
                                )}
                                <li
                                    id={optionId(index)}
                                    role="option"
                                    aria-selected={chosen}
                                    aria-disabled={disabled || undefined}
                                    title={disabled ? `At most ${max} can be chosen.` : undefined}
                                    onMouseDown={event => event.preventDefault()}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => { if (!disabled) pick(option.row); }}
                                    className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ${
                                        index === active ? 'bg-surface-alt' : ''
                                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true">
                                        {chosen && <Check className="h-4 w-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="min-w-0 break-words font-medium text-fg">{pickedName(option.row)}</span>
                                            {option.badge && (
                                                <span className="inline-flex items-center rounded-full bg-warning-muted px-2 py-0.5 text-xs font-semibold text-warning">
                                                    <PlusCircle className="mr-1 h-3 w-3" aria-hidden="true" />{option.badge}
                                                </span>
                                            )}
                                            {option.row.id != null && <span className="text-xs text-muted">#{option.row.id}</span>}
                                        </span>
                                        {option.detail && <span className="block break-words text-xs text-muted">{option.detail}</span>}
                                    </span>
                                </li>
                            </React.Fragment>
                        );
                    })}
                </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 first:border-t-0">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <p role="status" aria-live="polite" className={`text-xs ${statusClass}`}>
                        {loading && answer && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden="true" />}
                        {status}
                    </p>
                    {access.mode === 'lookup' && blockedFilters.length === 0 && (
                        <p className="text-xs text-muted">Names only: the full {typeLabel} table needs one of: {nodesText}.</p>
                    )}
                </div>
                {access.mode === 'full' && (
                    <button
                        type="button"
                        className="btn-tertiary inline-flex items-center gap-1 text-xs"
                        onMouseDown={event => event.preventDefault()}
                        onClick={onOpenTable}
                    >
                        <Table2 className="h-4 w-4" aria-hidden="true" />
                        Open full table
                    </button>
                )}
            </div>
        </div>
    );
});

/** The fallback: the full paged table (columns, filters, category filter, pinned rows) in a dialog. */
const FullTableDialog: React.FC<RelationPickerProps & { onClose: () => void }> = ({
    entityTypeName, mode, selected, onChange, min, max, filters, pinnedRows, refreshKey, label, onClose,
}) => (
    <Dialog
        open
        onClose={onClose}
        title={label}
        size="5xl"
        footer={<button type="button" className="btn-primary" onClick={onClose}>Done</button>}
        data-testid="relation-picker-table"
    >
        <PagedEntityTable
            // Remount when the context filters change - the table reads initialQuery once.
            key={JSON.stringify(filters ?? {})}
            entityTypeName={entityTypeName}
            columns={getColumnDefinitions(entityTypeName)}
            initialQuery={{ page: 1, pageSize: 10, filters: filters ?? {} }}
            selectionConfig={{ mode, min, max }}
            selectedItems={selected}
            onSelectionChange={next => {
                if (mode === 'single') {
                    if (next[0]) {
                        onChange([next[0]]);
                        onClose();
                    }
                    return;
                }
                onChange(next);
            }}
            showSearchBar
            showSelectionBanner={mode === 'multiple'}
            pinnedRows={pinnedRows}
            refreshKey={refreshKey}
        />
    </Dialog>
);
