import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Check, PlusCircle } from 'lucide-react';
import { PagedQueryDto, PagedResultDto } from '../../types/dtos/common/PagedQuery';
import { getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { logging } from '../../utils';
import { ColumnDefinition } from '../../types/common';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { buildPinnedSection, FilterScopes, isSameSelection, PinnedRow, tableRowKey } from '../../utils/forms/sessionPinnedRows';
import { CategoryFilterSelect } from './CategoryFilterSelect';
import { matchBuiltInColumn } from '../../utils/forms/savedColumns';
import { DataTable, DataTableColumn, DataTableSection, nextSort } from '../DataTable';
import { Pager } from '../Pager';
import { renderCellValue } from '../../utils/tableCells';

/** KNG-263: entities whose table offers a Category filter (a category includes its children). */
const CATEGORY_FILTER_ENTITIES = new Set(['itemblueprint']);
const CATEGORY_FILTER_KEY = 'CategoryId';

/** Whether the caller (e.g. a form field's picker filters) already fixes the category. */
const hasImposedCategoryFilter = (filters?: Record<string, string>): boolean =>
    Object.keys(filters ?? {}).some(filterKey => ['category', 'categoryid'].includes(filterKey.toLowerCase()));

/**
 * Amber "New" pill for the pinned session rows ("Created in this form"). The hybrid catalogue
 * tables that also showed it on unsaved rows are gone: materials and blocks since KNG-200 phase 5,
 * enchantments since KNG-250. Every table row is a saved database row, and picking one never
 * creates anything.
 */
const RowBadge: React.FC<{ label?: string }> = ({ label }) => (
    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full text-warning bg-warning-muted">
        <PlusCircle className="h-3 w-3 mr-1" />{label ?? 'New'}
    </span>
);

/**
 * Row keys made unique: a key that occurs again gets a `#n` suffix, so React never sees two rows
 * with one key (an older API could return the same catalogue entry twice in other notation).
 */
const uniqueRowKeys = (keys: string[]): string[] => {
    const counts = new Map<string, number>();
    return keys.map(key => {
        const count = counts.get(key) ?? 0;
        counts.set(key, count + 1);
        return count === 0 ? key : `${key}#${count}`;
    });
};

/**
 * Configuration for row selection behavior in the table.
 * Determines whether users can select single items, multiple items, or no selection at all.
 */
export interface SelectionConfig {
    /** 
     * Selection mode:
     * - 'single': Only one row can be selected at a time (radio button behavior)
     * - 'multiple': Multiple rows can be selected (checkbox behavior)
     * - 'none': Selection is disabled, table is read-only
     */
    mode: 'single' | 'multiple' | 'none';
    
    /** 
     * Minimum number of items that must be selected.
     * Used for validation - prevents deselection if it would violate this constraint.
     * Optional. If undefined or 0, no minimum is enforced.
     */
    min?: number;
    
    /** 
     * Maximum number of items that can be selected.
     * Used to limit selection - prevents selection if it would exceed this constraint.
     * Optional. If undefined, no maximum is enforced.
     */
    max?: number;
}

/**
 * Props for the PagedEntityTable component.
 * This component provides a full-featured data table with pagination, sorting, searching,
 * and optional row selection capabilities.
 * 
 * @template T - The type of entity/row data being displayed in the table
 */
export interface PagedEntityTableProps<T> {
    /** 
     * The entity type name used for API calls.
     * Must match a registered entity in entityApiMapping.ts.
     * Example: 'category', 'structure', 'user'
     */
    entityTypeName: string;
    
    /** 
     * Column definitions that specify which fields to display and how to render them.
     * Each column includes the data key, label, sortability, and optional custom renderer.
     * See ColumnDefinition type for full options.
     */
    columns?: ColumnDefinition<T>[];
    
    /** 
     * Initial query parameters for the table.
     * Allows pre-configuring page number, page size, search term, sorting, and filters.
     * Merged with default values (page: 1, pageSize: 10, etc.)
     */
    initialQuery?: Partial<PagedQueryDto>;
    
    /** 
     * Callback fired when a row is clicked (only if selection is disabled).
     * Typically used for navigation to detail views.
     * Note: When selectionConfig.mode !== 'none', clicking rows triggers selection instead.
     * 
     * @param row - The row data that was clicked
     */
    onRowClick?: (row: T) => void;
    
    /** 
     * Array of action button renderers for each row.
     * Each function receives the row data and returns a React node (typically a button).
     * Actions appear in the rightmost column of the table.
     * Example: [(row) => <EditButton onClick={() => edit(row)} />]
     */
    rowActions?: Array<(row: T) => React.ReactNode>;
    
    /** 
     * Custom toolbar actions/buttons to display in the top-right of the table.
     * Appears next to the search bar (if enabled).
     * Useful for bulk actions, filters, or create buttons.
     */
    toolbarActions?: React.ReactNode;
    
    /** 
     * Configuration for row selection behavior.
     * Controls whether users can select rows, how many, and the selection mode.
     * When provided (mode !== 'none'), rows become selectable with visual feedback.
     * See SelectionConfig interface for detailed options.
     * Default: { mode: 'none' } (selection disabled)
     */
    selectionConfig?: SelectionConfig;
    
    /** 
     * Currently selected items (controlled component pattern).
     * Pass this prop to control selection state externally.
     * Must be used in conjunction with onSelectionChange.
     * The table will sync its internal selection with this prop.
     */
    selectedItems?: T[];
    
    /** 
     * Callback fired when selection changes.
     * Provides the updated array of selected items.
     * Use this to maintain selection state in parent component.
     * 
     * @param selected - Array of currently selected row data
     */
    onSelectionChange?: (selected: T[]) => void;
    
    /** 
     * Controls visibility of the search input field in the toolbar.
     * When false, the search bar is hidden (useful for embedded tables with external search).
     * Default: true
     */
    showSearchBar?: boolean;
    
    /** 
     * Controls visibility of the selection info banner.
     * The banner shows "X items selected (min: Y, max: Z)" with a clear button.
     * When false, the banner is hidden (useful when you have custom selection display).
     * Only relevant when selectionConfig.mode !== 'none'.
     * Default: true
     */
    showSelectionBanner?: boolean;

    /**
     * Changing this value forces the table to refetch data.
     * Useful for parent components to trigger a refresh after mutations.
     */
    refreshKey?: string | number;

    /**
     * PandiO/knk-workspace#183: changing this value refetches the current page *quietly*: the rows
     * stay on screen (no spinner) and are replaced when the answer arrives. For live updates
     * (another admin's change), where a spinner would make the table jump.
     */
    liveRefreshKey?: string | number;

    /**
     * KNG-136: rows created in this form session (useSessionPinnedRows), shown above the page
     * results in a "Created in this form" section with a New badge. They obey the search term and
     * the query's filters (client-side, see utils/forms/sessionPinnedRows.ts) and a row the page
     * also holds is shown once, pinned, with the page's data.
     */
    pinnedRows?: Array<PinnedRow<T>>;

    /**
     * #177 link 2: shown in place of "No results found" when the list is empty and nothing is
     * searched for, e.g. a "New {Type}" button on the dashboard.
     */
    emptyState?: React.ReactNode;

    /**
     * PandiO/knk-workspace#39: controlled mode. When given, page, search, sort and filters come from
     * here (merged over the defaults and `initialQuery`) and every change goes to `onQueryChange`
     * instead of the table's own state, e.g. so the dashboard keeps them in the URL
     * (utils/tableQueryParams.ts). Without it the table keeps its own state, as the form wizard's
     * pickers do.
     */
    query?: Partial<PagedQueryDto>;

    /** Controlled mode: the query the table wants next (a page, sort, search or filter change). */
    onQueryChange?: (query: PagedQueryDto) => void;

    /**
     * PandiO/knk-workspace#39 (CRUD-4): the address a row opens, e.g. its detail page. The first cell
     * becomes a link to it, so middle-click, Ctrl/Cmd-click and the keyboard work; a plain click
     * (on the link or the row) still calls `onRowClick`. Ignored while rows are selectable.
     */
    rowHref?: (row: T) => string | undefined;

    /**
     * PandiO/knk-workspace#205: how rows are selected with `selectionConfig.mode` 'multiple'.
     * - `row` (default, the wizard pickers): a click on the row selects it; rows aren't links then.
     * - `checkbox` (the dashboard): a checkbox column selects, while `rowHref` and `onRowClick` keep working, and
     *   the header box selects or clears the rows shown.
     */
    selectionStyle?: 'row' | 'checkbox';

    /**
     * PandiO/knk-workspace#205: a bar between the toolbar and the table (the dashboard's bulk bar: "n selected",
     * Export CSV), given the selection and what the table shows: its columns in table order, the current query
     * and the search's total.
     */
    renderSelectionBar?: (state: SelectionBarState<T>) => React.ReactNode;
}

/** What `renderSelectionBar` gets (#205). */
export interface SelectionBarState<T> {
    selected: T[];
    clearSelection: () => void;
    /** The table's columns, in table order (metadata's default columns or the given ones). */
    columns: ColumnDefinition<T>[];
    /** The current page, search, sort and filters. */
    query: PagedQueryDto;
    /** Rows of the current search across all pages. */
    totalCount: number;
    loading: boolean;
}

const DEFAULT_QUERY: PagedQueryDto = {
    page: 1,
    pageSize: 10,
    searchTerm: '',
    sortBy: undefined,
    sortDescending: false,
    filters: {},
};

/** True when a filter narrows the list (a value other than empty/null/undefined). */
const hasActiveFilters = (filters: PagedQueryDto['filters']): boolean =>
    !!filters && Object.values(filters).some(value => value !== undefined && value !== null && value !== '');

export function PagedEntityTable<T extends Record<string, any>>({
    entityTypeName,
    columns = [],
    initialQuery = {},
    onRowClick,
    rowActions = [],
    toolbarActions,
    selectionConfig = { mode: 'none' },
    selectedItems = [],
    onSelectionChange,
    showSearchBar = true,
    showSelectionBanner = true,
    refreshKey,
    liveRefreshKey,
    pinnedRows,
    emptyState,
    query: controlledQuery,
    onQueryChange,
    rowHref,
    selectionStyle = 'row',
    renderSelectionBar
}: PagedEntityTableProps<T>) {
    const { baseMetadata, allMergedMetadata } = useEntityMetadata();

    const [internalQuery, setInternalQuery] = useState<PagedQueryDto>({
        ...DEFAULT_QUERY,
        ...initialQuery
    });

    // #39: in controlled mode the query is the caller's. Kept as one object per distinct value, so
    // the fetch effect only runs when something really changed (a new object per render would
    // refetch forever).
    const isControlled = controlledQuery !== undefined;
    const controlledKey = isControlled ? JSON.stringify({ ...DEFAULT_QUERY, ...initialQuery, ...controlledQuery }) : '';
    const controlledValue = useMemo<PagedQueryDto | null>(
        () => (controlledKey ? JSON.parse(controlledKey) as PagedQueryDto : null),
        [controlledKey]
    );
    const query = controlledValue ?? internalQuery;
    const queryRef = useRef(query);
    queryRef.current = query;

    /** One way to change the query in both modes; `update` gets the latest query. */
    const setQuery = useCallback((update: (previous: PagedQueryDto) => PagedQueryDto) => {
        if (isControlled) {
            const next = update(queryRef.current);
            if (JSON.stringify(next) !== JSON.stringify(queryRef.current)) onQueryChange?.(next);
            return;
        }
        setInternalQuery(update);
    }, [isControlled, onQueryChange]);

    const [data, setData] = useState<PagedResultDto<T>>({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(query.searchTerm || '');
    const [internalSelection, setInternalSelection] = useState<T[]>(selectedItems);
    // KNG-263: the category filter's chosen category and the ids it covers (itself and its children).
    const showCategoryFilter = CATEGORY_FILTER_ENTITIES.has(entityTypeName.toLowerCase())
        && !hasImposedCategoryFilter(initialQuery.filters);
    const [categoryScope, setCategoryScope] = useState<ReadonlySet<string> | undefined>(undefined);

    const handleCategoryFilterChange = (categoryId: string | undefined, covered: ReadonlySet<string> | undefined) => {
        setCategoryScope(covered);
        setQuery(prev => {
            const { [CATEGORY_FILTER_KEY]: _previous, ...otherFilters } = prev.filters ?? {};
            return {
                ...prev,
                page: 1,
                filters: categoryId ? { ...otherFilters, [CATEGORY_FILTER_KEY]: categoryId } : otherFilters
            };
        });
    };
    // KNG-200: numbers the fetches, so only the latest one's response reaches the table.
    const requestSeq = useRef(0);

    const fallbackColumns = useMemo<ColumnDefinition<T>[]>(() => {
        if (columns.length > 0) {
            return columns;
        }

        return [
            { key: 'id', label: 'ID', sortable: true },
            { key: 'name', label: 'Name', sortable: true }
        ];
    }, [columns]);

    const configuredColumnKeys = useMemo(() => {
        const normalized = entityTypeName.toLowerCase();
        const fromBase = baseMetadata.find(m => m.entityName.toLowerCase() === normalized)?.defaultTableColumns;
        if (fromBase && fromBase.length > 0) {
            return fromBase;
        }

        return allMergedMetadata.find(m => m.entityName.toLowerCase() === normalized)?.defaultTableColumns;
    }, [entityTypeName, baseMetadata, allMergedMetadata]);

    const entityFieldKeySet = useMemo(() => {
        const normalized = entityTypeName.toLowerCase();
        const fromBase = baseMetadata.find(m => m.entityName.toLowerCase() === normalized);
        const fromMerged = allMergedMetadata.find(m => m.entityName.toLowerCase() === normalized);
        const source = fromBase || fromMerged;

        const fieldKeys = (source?.fields || []).map(field => field.fieldName.toLowerCase());
        const propertyKeys = (source?.properties || []).map(property => property.name.toLowerCase());

        return new Set([...fieldKeys, ...propertyKeys]);
    }, [entityTypeName, baseMetadata, allMergedMetadata]);

    const guardedColumnKeys = useMemo(() => {
        const baseKeys = (configuredColumnKeys && configuredColumnKeys.length > 0)
            ? configuredColumnKeys
            : fallbackColumns.map(column => column.key);

        const hasNameField = entityFieldKeySet.has('name');
        const hasDisplayNameField = entityFieldKeySet.has('displayname');

        if (!hasNameField && hasDisplayNameField) {
            return baseKeys.map(key => key.toLowerCase() === 'name' ? 'displayName' : key);
        }

        return baseKeys;
    }, [configuredColumnKeys, fallbackColumns, entityFieldKeySet]);

    const effectiveColumns = useMemo(() => {
        const mapped = guardedColumnKeys
            .map(key => {
                const existing = matchBuiltInColumn(key, fallbackColumns);
                if (existing) {
                    return existing;
                }

                return {
                    key,
                    label: key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/[_-]/g, ' ')
                        .replace(/^./, c => c.toUpperCase())
                        .trim(),
                    sortable: true
                } as ColumnDefinition<T>;
            })
            .filter((column, index, source) => source.findIndex(c => c.key.toLowerCase() === column.key.toLowerCase()) === index);

        return mapped.length > 0 ? mapped : fallbackColumns;
    }, [guardedColumnKeys, fallbackColumns]);

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== queryRef.current.searchTerm) {
                setQuery(prev => ({ ...prev, searchTerm: searchInput, page: 1 }));
            }
        }, 400);

        return () => clearTimeout(timer);
    // Deps kept as they are on purpose for now; see PandiO/knk-workspace#218.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    // #39: a search term changed from outside (Back/Forward, a link) shows in the box.
    useEffect(() => {
        setSearchInput(query.searchTerm || '');
    }, [query.searchTerm]);

    // Fetch data when query changes
    useEffect(() => {
        fetchData();
    // Deps kept as they are on purpose for now; see PandiO/knk-workspace#218.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, entityTypeName, refreshKey]);

    // #183: a live update refetches quietly (only when the key changes, not on mount).
    const lastLiveRefreshKey = useRef(liveRefreshKey);
    useEffect(() => {
        if (lastLiveRefreshKey.current === liveRefreshKey) return;
        lastLiveRefreshKey.current = liveRefreshKey;
        void fetchData(true);
    // Only the key: fetchData is the current render's (same query and type).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveRefreshKey]);

    // Sync internal selection with prop changes (only if actually different). Id-less items only
    // match themselves (KNG-136), so two unsaved items no longer count as the same selection.
    useEffect(() => {
        const isDifferent = selectedItems.length !== internalSelection.length ||
            selectedItems.some(item => !internalSelection.some(sel => isSameSelection(sel, item, entityTypeName)));
        
        if (isDifferent) {
            setInternalSelection(selectedItems);
        }
    // Deps kept as they are on purpose for now; see PandiO/knk-workspace#218.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItems, entityTypeName]);

    const fetchData = useCallback(async (quiet = false) => {
        const seq = ++requestSeq.current;
        const isLatest = () => seq === requestSeq.current;
        try {
            // #183: a quiet refresh keeps the rows; the latest request still ends any spinner.
            if (!quiet) setLoading(true);
            setError(null);

            const searchFn = getSearchFunctionForEntity(entityTypeName);
            const result = await searchFn(query);
            if (isLatest()) setData(result);
        } catch (err) {
            // A failed request a later one has replaced says nothing about the current results.
            if (!isLatest()) return;
            console.error('Failed to fetch data:', err);
            setError('Failed to load data');
            logging.errorHandler.next(`ErrorMessage.${entityTypeName}.LoadFailed`);
        } finally {
            if (isLatest()) setLoading(false);
        }
    }, [query, entityTypeName]);

    // #187: the sort cycle (asc → desc → off) is DataTable's nextSort.
    const handleSort = (columnKey: string) => {
        setQuery(prev => {
            const next = nextSort(prev.sortBy ? { key: prev.sortBy, descending: prev.sortDescending === true } : null, columnKey);
            return next
                ? { ...prev, sortBy: next.key, sortDescending: next.descending }
                : { ...prev, sortBy: undefined, sortDescending: undefined };
        });
    };

    // #39: a page past the end (a shared link, rows deleted meanwhile) moves to the last page.
    useEffect(() => {
        if (loading || error || data.items.length > 0 || data.totalCount <= 0) return;
        const lastPage = Math.max(1, Math.ceil(data.totalCount / query.pageSize));
        if (query.page > lastPage) setQuery(prev => ({ ...prev, page: lastPage }));
    }, [loading, error, data.items.length, data.totalCount, query.page, query.pageSize, setQuery]);

    const handlePageChange = (newPage: number) => {
        const maxPage = data.totalCount > 0
            ? Math.ceil(data.totalCount / query.pageSize)
            : 1;

        if (newPage >= 1 && newPage <= maxPage) {
            setQuery(prev => ({ ...prev, page: newPage }));
        }
    };

    // Rows compare by id (see isSameSelection).
    const isRowSelected = (row: T): boolean =>
        internalSelection.some(item => isSameSelection(item, row, entityTypeName));

    const handleRowSelection = (row: T, event?: React.MouseEvent) => {
        if (selectionConfig.mode === 'none') return;

        // Prevent triggering onRowClick when clicking checkbox
        if (event) {
            event.stopPropagation();
        }

        let newSelection: T[];

        if (selectionConfig.mode === 'single') {
            newSelection = isRowSelected(row) ? [] : [row];
        } else {
            // Multiple selection mode
            if (isRowSelected(row)) {
                newSelection = internalSelection.filter(item => !isSameSelection(item, row, entityTypeName));

                // Check min constraint
                if (selectionConfig.min && newSelection.length < selectionConfig.min) {
                    return; // Don't allow deselection if it violates min
                }
            } else {
                // Select
                // Check max constraint
                if (selectionConfig.max && internalSelection.length >= selectionConfig.max) {
                    return; // Don't allow selection if it violates max
                }
                newSelection = [...internalSelection, row];
            }
        }

        setInternalSelection(newSelection);
        onSelectionChange?.(newSelection);
    };

    const section = useMemo(() => {
        const scopes: FilterScopes | undefined = categoryScope ? { [CATEGORY_FILTER_KEY]: categoryScope } : undefined;
        return buildPinnedSection(pinnedRows, data.items, query.searchTerm, query.filters, scopes);
    }, [pinnedRows, data.items, query.searchTerm, query.filters, categoryScope]);

    // added: determine if pagination should be shown
    const shouldShowPagination = !loading && data.items.length > 0 && data.totalCount > query.pageSize;

    // #187: the table is DataTable (row links, aria-sort, sections); this component keeps the fetching,
    // the query (own or the caller's), the selection and the pinned rows.
    const selectable = selectionConfig.mode !== 'none';
    // #205: with checkboxes the row keeps its link and click; only the checkbox column selects.
    const checkboxSelection = selectable && selectionStyle === 'checkbox' && selectionConfig.mode === 'multiple';
    const rowClickSelects = selectable && !checkboxSelection;
    const tableColumns = useMemo<DataTableColumn<T>[]>(() => effectiveColumns.map(column => ({
        key: column.key,
        header: column.label,
        sortable: column.sortable,
        cell: (row: T) => renderCellValue(row, column),
    // renderCellValue is a plain function of the row and column.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [effectiveColumns]);

    /** The header box: select every row shown (up to `max`), or clear them when all are selected. */
    const toggleShownRows = () => {
        const shown = [...section.pinned.map(pin => pin.row), ...section.pageItems];
        const allSelected = shown.length > 0 && shown.every(isRowSelected);
        let next: T[];
        if (allSelected) {
            next = internalSelection.filter(item => !shown.some(row => isSameSelection(item, row, entityTypeName)));
            if (selectionConfig.min && next.length < selectionConfig.min) return;
        } else {
            next = [...internalSelection];
            for (const row of shown) {
                if (selectionConfig.max && next.length >= selectionConfig.max) break;
                if (!next.some(item => isSameSelection(item, row, entityTypeName))) next.push(row);
            }
        }
        setInternalSelection(next);
        onSelectionChange?.(next);
    };

    const clearSelection = () => {
        setInternalSelection([]);
        onSelectionChange?.([]);
    };

    const rowSelectLabel = (row: T): string => {
        const name = (row as any)?.name ?? (row as any)?.displayName ?? (row as any)?.label;
        return name ? `Select ${name}` : (row as any)?.id != null ? `Select ID ${(row as any).id}` : 'Select row';
    };

    const pageKeys = uniqueRowKeys(section.pageItems.map((row, index) => tableRowKey(row, entityTypeName, index)));
    const tableSections: DataTableSection<T>[] = [
        {
            key: 'pinned',
            label: 'Created in this form',
            tone: 'warning',
            rows: section.pinned.map(pin => ({
                key: `pinned:${pin.key}`,
                row: pin.row,
                leading: <RowBadge label={pin.badge ?? 'New'} />,
            })),
        },
        {
            key: 'page',
            label: section.pinned.length > 0 ? 'Search results' : undefined,
            rows: section.pageItems.map((row, index) => ({ key: pageKeys[index], row })),
        },
    ];

    return (
        <div className="w-full space-y-4">
            {/* Toolbar - changed: conditionally render based on showSearchBar prop */}
            {(showSearchBar || toolbarActions || showCategoryFilter) && (
                <div className="flex items-center justify-between">
                    {showSearchBar && (
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Search..."
                                className="pl-10 block w-full rounded-md border-field shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                    )}
                    {showCategoryFilter && (
                        <div className={showSearchBar ? 'ml-4' : ''}>
                            <CategoryFilterSelect
                                value={query.filters?.[CATEGORY_FILTER_KEY]}
                                onChange={handleCategoryFilterChange}
                            />
                        </div>
                    )}
                    {toolbarActions && (
                        <div className={showSearchBar || showCategoryFilter ? 'ml-4' : ''}>
                            {toolbarActions}
                        </div>
                    )}
                </div>
            )}

            {renderSelectionBar?.({
                selected: internalSelection,
                clearSelection,
                columns: effectiveColumns,
                query,
                totalCount: data.totalCount,
                loading,
            })}

            {/* Selection Info Banner - changed: conditionally render based on showSelectionBanner prop */}
            {showSelectionBanner && selectionConfig.mode !== 'none' && internalSelection.length > 0 && (
                <div className="bg-info-soft border border-info-line rounded-md px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-info-strong">
                        {internalSelection.length} item{internalSelection.length !== 1 ? 's' : ''} selected
                        {selectionConfig.min && ` (min: ${selectionConfig.min})`}
                        {selectionConfig.max && ` (max: ${selectionConfig.max})`}
                    </span>
                    {selectionConfig.mode === 'multiple' && (!selectionConfig.min || selectionConfig.min === 0) && (
                        <button
                            onClick={clearSelection}
                            className="text-sm text-primary hover:text-info-strong underline"
                        >
                            Clear selection
                        </button>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-danger-soft border border-danger-line rounded-md p-4">
                    <p className="text-sm text-danger-strong">{error}</p>
                </div>
            )}

            {/* Table */}
            <DataTable<T>
                columns={tableColumns}
                sections={tableSections}
                loading={loading}
                sort={query.sortBy ? { key: query.sortBy, descending: query.sortDescending === true } : null}
                onSortChange={handleSort}
                // #39 (CRUD-4): a row with an address is a link (first cell), unless a row click selects (#205:
                // with checkboxes it stays a link).
                rowHref={rowClickSelects ? undefined : rowHref}
                onRowClick={rowClickSelects ? (row => handleRowSelection(row)) : onRowClick}
                isRowSelected={selectable ? isRowSelected : undefined}
                selection={checkboxSelection ? {
                    isSelected: isRowSelected,
                    onToggle: row => handleRowSelection(row),
                    onToggleAll: toggleShownRows,
                    rowLabel: rowSelectLabel,
                } : undefined}
                rowLeading={rowClickSelects ? (row => isRowSelected(row)
                    ? <><Check className="h-5 w-5 text-success flex-shrink-0" aria-hidden="true" /><span className="sr-only">Selected:</span></>
                    : null) : undefined}
                rowActions={rowActions.length > 0 ? (row => rowActions.map((action, actionIndex) => (
                    <React.Fragment key={actionIndex}>{action(row)}</React.Fragment>
                ))) : undefined}
                empty={emptyState && !query.searchTerm && !hasActiveFilters(query.filters) ? emptyState : 'No results found'}
            />

            {/* Pagination: only with more than one page */}
            {shouldShowPagination && (
                <Pager
                    page={query.page}
                    pageSize={query.pageSize}
                    totalCount={data.totalCount}
                    onPageChange={handlePageChange}
                />
            )}
        </div>
    );
}

