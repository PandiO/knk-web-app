import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Loader2, ChevronLeft, ChevronRight, Check, PlusCircle } from 'lucide-react';
import { PagedQueryDto, PagedResultDto } from '../../types/dtos/common/PagedQuery';
import { getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { logging } from '../../utils';
import { ColumnDefinition } from '../../types/common';
import { minecraftMaterialRefClient } from '../../apiClients/minecraftMaterialRefClient';
import { minecraftBlockRefClient } from '../../apiClients/minecraftBlockRefClient';
import { minecraftEnchantmentRefClient } from '../../apiClients/minecraftEnchantmentRefClient';
import { enchantmentDefinitionClient } from '../../apiClients/enchantmentDefinitionClient';
import { useEntityMetadata } from '../../hooks/useEntityMetadata';
import { buildPinnedSection, catalogKeyOf, isSameSelection, PinnedRow, tableRowKey } from '../../utils/forms/sessionPinnedRows';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { matchBuiltInColumn } from '../../utils/forms/savedColumns';

/**
 * Amber "New" pill for the pinned session rows and for hybrid picker rows the database does not
 * have yet. KNG-200 phase 4 dropped the green "Existing" pill: once the picker answers from the
 * database every row is saved, so it marked every row.
 */
const RowBadge: React.FC<{ label?: string }> = ({ label }) => (
    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full text-amber-700 bg-amber-100">
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
     * KNG-136: rows created in this form session (useSessionPinnedRows), shown above the page
     * results in a "Created in this form" section with a New badge. They obey the search term and
     * the query's filters (client-side, see utils/forms/sessionPinnedRows.ts) and a row the page
     * also holds is shown once, pinned, with the page's data.
     */
    pinnedRows?: Array<PinnedRow<T>>;
}

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
    pinnedRows
}: PagedEntityTableProps<T>) {
    const { baseMetadata, allMergedMetadata } = useEntityMetadata();

    const [query, setQuery] = useState<PagedQueryDto>({
        page: 1,
        pageSize: 10,
        searchTerm: '',
        sortBy: undefined,
        sortDescending: false,
        filters: {},
        ...initialQuery
    });

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
    const [creatingKey, setCreatingKey] = useState<string | null>(null);
    const [selectingAll, setSelectingAll] = useState(false);
    // KNG-200: numbers the fetches, so only the latest one's response reaches the table.
    const requestSeq = useRef(0);
    const [isHybridMode, setIsHybridMode] = useState(false);
    const [isAutoCreateMode, setIsAutoCreateMode] = useState(false);

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
            if (searchInput !== query.searchTerm) {
                setQuery(prev => ({ ...prev, searchTerm: searchInput, page: 1 }));
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchInput]);

    // Detect hybrid mode on mount
    useEffect(() => {
        const normalized = entityTypeName.toLowerCase();
        const isHybrid = normalized === 'minecraftmaterialref' || normalized === 'minecraftblockref' || normalized === 'minecraftenchantmentref';
        setIsHybridMode(isHybrid);
        // Only material and block refs should auto-create on selection; enchantments are pre-persisted
        const shouldAutoCreate = normalized === 'minecraftmaterialref' || normalized === 'minecraftblockref' || normalized === 'minecraftenchantmentref';
        setIsAutoCreateMode(shouldAutoCreate);
    }, [entityTypeName]);

    // Fetch data when query changes
    useEffect(() => {
        fetchData();
    }, [query, entityTypeName, refreshKey]);

    // Sync internal selection with prop changes (only if actually different). Id-less items only
    // match themselves (KNG-136), so two unsaved items no longer count as the same selection.
    useEffect(() => {
        const isDifferent = selectedItems.length !== internalSelection.length ||
            selectedItems.some(item => !internalSelection.some(sel => isSameSelection(sel, item, entityTypeName)));
        
        if (isDifferent) {
            setInternalSelection(selectedItems);
        }
    }, [selectedItems, entityTypeName]);

    const fetchData = useCallback(async () => {
        const seq = ++requestSeq.current;
        const isLatest = () => seq === requestSeq.current;
        try {
            setLoading(true);
            setError(null);

            const normalized = entityTypeName.toLowerCase();
            
            // Check if this is a hybrid mode entity
            if (normalized === 'minecraftmaterialref' || normalized === 'minecraftblockref' || normalized === 'minecraftenchantmentref') {
                // Use searchPaged with SearchHybrid filter
                const hybridQuery: PagedQueryDto = {
                    ...query,
                    filters: {
                        ...query.filters,
                        SearchHybrid: 'true'
                    }
                };
                
                const searchFn = getSearchFunctionForEntity(entityTypeName);
                const result = await searchFn(hybridQuery);

                if (isLatest()) setData(result);
            } else {
                // Normal paged search
                const searchFn = getSearchFunctionForEntity(entityTypeName);
                const result = await searchFn(query);
                if (isLatest()) setData(result);
            }
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

    const handleSort = (columnKey: string) => {
        setQuery(prev => {
            if (prev.sortBy === columnKey) {
                // Toggle sort direction or clear sort
                return {
                    ...prev,
                    sortDescending: prev.sortDescending === false ? true : undefined,
                    sortBy: prev.sortDescending === true ? undefined : columnKey
                };
            }
            return { ...prev, sortBy: columnKey, sortDescending: false };
        });
    };

    const getSortIcon = (columnKey: string) => {
        if (query.sortBy !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
        return query.sortDescending ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />;
    };

    const getValueByKeyPath = (source: any, keyPath: string): any => {
        if (!source || !keyPath) {
            return undefined;
        }

        const segments = keyPath.split('.').filter(Boolean);
        let current: any = source;

        for (const segment of segments) {
            if (current == null || typeof current !== 'object') {
                return undefined;
            }

            if (Object.prototype.hasOwnProperty.call(current, segment)) {
                current = current[segment];
                continue;
            }

            const matchedKey = Object.keys(current).find(
                key => key.toLowerCase() === segment.toLowerCase()
            );

            if (!matchedKey) {
                return undefined;
            }

            current = current[matchedKey];
        }

        return current;
    };

    const renderCellValue = (row: T, column: ColumnDefinition<T>) => {
        if (column.render) {
            return column.render(row);
        }

        const value = getValueByKeyPath(row, column.key);

        if (value === null || value === undefined) {
            return <span className="text-gray-400">-</span>;
        }

        if (typeof value === 'boolean') {
            return (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                    {value ? 'Yes' : 'No'}
                </span>
            );
        }

        if (value instanceof Date) {
            return value.toLocaleDateString();
        }

        // Handle objects - try common property names for display
        if (typeof value === 'object') {
            // Try various common property names (case-insensitive)
            if ('name' in value && value.name) {
                return String(value.name);
            }
            if ('Name' in value && value.Name) {
                return String(value.Name);
            }
            if ('title' in value && value.title) {
                return String(value.title);
            }
            if ('label' in value && value.label) {
                return String(value.label);
            }
            if ('id' in value) {
                return String(value.id);
            }
            // Fallback: don't render the object, show a placeholder
            return <span className="text-gray-400">-</span>;
        }

        return String(value);
    };

    const handlePageChange = (newPage: number) => {
        const maxPage = data.totalCount > 0
            ? Math.ceil(data.totalCount / query.pageSize)
            : 1;

        if (newPage >= 1 && newPage <= maxPage) {
            setQuery(prev => ({ ...prev, page: newPage }));
        }
    };

    // Enchantment refs compare by namespaceKey, other rows by id (see isSameSelection).
    const isRowSelected = (row: T): boolean =>
        internalSelection.some(item => isSameSelection(item, row, entityTypeName));

    // added: handle row selection with hybrid mode support
    const handleRowSelection = async (row: T, event?: React.MouseEvent) => {
        if (selectionConfig.mode === 'none') return;

        // Prevent triggering onRowClick when clicking checkbox
        if (event) {
            event.stopPropagation();
        }

        // While a catalogue row is being saved the selection is about to change: ignore clicks.
        if (creatingKey || selectingAll) return;

        // An unsaved catalogue row is saved first; an already selected one is just deselected.
        if (isAutoCreateMode && (row as any).isPersisted === false && !isRowSelected(row)) {
            await handleCreateAndSelect(row);
            return;
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

    /**
     * KNG-200: saves an unsaved catalogue row through get-or-create (materials and blocks), so a key
     * someone saved in the meantime, or a second quick pick, returns the existing row instead of
     * failing. Enchantment refs keep their create + definition pair. Returns the saved DTO.
     */
    const persistUnsavedRow = async (row: T): Promise<any> => {
        const option = row as any;
        const normalized = entityTypeName.toLowerCase();

        if (normalized === 'minecraftmaterialref') {
            return minecraftMaterialRefClient.persistFromCatalog(option.namespaceKey, option.category, option.legacyName);
        }
        if (normalized === 'minecraftblockref') {
            return minecraftBlockRefClient.getOrCreate({
                namespaceKey: option.namespaceKey,
                blockStateString: option.blockStateString,
                logicalType: option.logicalType,
                iconUrl: option.iconUrl
            });
        }
        if (normalized === 'minecraftenchantmentref') {
            const created = await minecraftEnchantmentRefClient.create({
                namespaceKey: option.namespaceKey,
                legacyName: option.legacyName,
                category: option.category,
                maxLevel: option.maxLevel,
                displayName: option.displayName,
                iconUrl: option.iconUrl
            });
            await enchantmentDefinitionClient.create({
                key: option.namespaceKey,
                displayName: option.displayName,
                maxLevel: option.maxLevel,
                isCustom: false,
                minecraftEnchantmentRefId: created.id
            });
            return created;
        }
        return undefined;
    };

    /** The row as saved: its new id, marked persisted. */
    const asSaved = (row: T, id: unknown): T => ({ ...row, id, isPersisted: true } as T);

    /**
     * Marks the page's unsaved rows of the saved catalogue entries as saved. Rows match by catalogue
     * key (normalised namespaceKey, plus block state for blocks), not by the exact spelling.
     */
    const markRowsSaved = (saved: Array<{ key: string | undefined; id: unknown }>) => {
        const savedByKey = new Map<string, unknown>();
        saved.forEach(entry => {
            if (entry.key !== undefined) savedByKey.set(entry.key, entry.id);
        });
        if (savedByKey.size === 0) return;
        setData(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if ((item as any).isPersisted !== false) return item;
                const key = catalogKeyOf(item, entityTypeName);
                return key !== undefined && savedByKey.has(key) ? asSaved(item, savedByKey.get(key)) : item;
            })
        }));
    };

    /**
     * "Select all on this page" (multiple mode): adds the page's rows that are not selected yet, up to
     * `max`. Unsaved catalogue rows are saved one after the other first (KNG-200); when one fails the
     * rows before it are still added and the error is shown. Unchecking removes the page's rows,
     * unless that would go below `min`.
     */
    const handleSelectAll = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (selectionConfig.mode !== 'multiple' || creatingKey || selectingAll) return;

        if (!event.target.checked) {
            const remaining = internalSelection.filter(item => !data.items.some(row => isSameSelection(item, row, entityTypeName)));
            if (selectionConfig.min && remaining.length < selectionConfig.min) return;
            setInternalSelection(remaining);
            onSelectionChange?.(remaining);
            return;
        }

        const room = selectionConfig.max ? Math.max(selectionConfig.max - internalSelection.length, 0) : Infinity;
        const candidates = data.items.filter(row => !isRowSelected(row)).slice(0, room);
        if (candidates.length === 0) return;

        const toAdd: T[] = [];
        const saved: Array<{ key: string | undefined; id: unknown }> = [];
        setSelectingAll(true);
        setError(null);
        try {
            for (const row of candidates) {
                if (isAutoCreateMode && (row as any).isPersisted === false) {
                    const key = catalogKeyOf(row, entityTypeName);
                    setCreatingKey(key ?? 'creating');
                    const created = await persistUnsavedRow(row);
                    if (!created?.id) continue;
                    saved.push({ key, id: created.id });
                    const savedRow = asSaved(row, created.id);
                    if (!toAdd.some(item => isSameSelection(item, savedRow, entityTypeName))
                        && !internalSelection.some(item => isSameSelection(item, savedRow, entityTypeName))) {
                        toAdd.push(savedRow);
                    }
                } else {
                    toAdd.push(row);
                }
            }
        } catch (err) {
            setError(apiRefusalReason(err) ?? 'Failed to create item');
        } finally {
            setCreatingKey(null);
            setSelectingAll(false);
        }

        markRowsSaved(saved);
        if (toAdd.length > 0) {
            const newSelection = [...internalSelection, ...toAdd];
            setInternalSelection(newSelection);
            onSelectionChange?.(newSelection);
        }
    };

    const allVisibleSelected = data.items.length > 0 && 
        data.items.every(row => isRowSelected(row));

    const section = useMemo(
        () => buildPinnedSection(pinnedRows, data.items, query.searchTerm, query.filters),
        [pinnedRows, data.items, query.searchTerm, query.filters]
    );

    // added: handle create and select for hybrid mode
    const handleCreateAndSelect = async (row: T) => {
        if (creatingKey || selectingAll) return;
        const key = catalogKeyOf(row, entityTypeName);
        setCreatingKey(key ?? 'creating');
        setError(null);

        try {
            const created = await persistUnsavedRow(row);

            if (created?.id) {
                markRowsSaved([{ key, id: created.id }]);

                // Select the saved item (once: get-or-create may return a row that is already selected)
                const updatedRow = asSaved(row, created.id);
                let newSelection: T[];

                if (selectionConfig.mode === 'single') {
                    newSelection = [updatedRow];
                } else {
                    const others = internalSelection.filter(item => !isSameSelection(item, updatedRow, entityTypeName));
                    if (selectionConfig.max && others.length >= selectionConfig.max) {
                        return;
                    }
                    newSelection = [...others, updatedRow];
                }

                setInternalSelection(newSelection);
                onSelectionChange?.(newSelection);
            }
        } catch (err) {
            setError(apiRefusalReason(err) ?? 'Failed to create item');
        } finally {
            setCreatingKey(null);
        }
    };

    // added: determine if pagination should be shown
    const shouldShowPagination = !loading && data.items.length > 0 && data.totalCount > query.pageSize;
    const totalPagesDerived = data.totalCount > 0
        ? Math.ceil(data.totalCount / query.pageSize)
        : 1;
    const isOnFirstPage = query.page <= 1;
    const isOnLastPage = query.page * query.pageSize >= data.totalCount || query.page >= totalPagesDerived;

    const columnCount = effectiveColumns.length + (rowActions.length > 0 ? 1 : 0);

    // One table row. Keys are stable (id, namespaceKey, ...) instead of the array index (KNG-136).
    const renderRow = (row: T, rowKey: string, sessionBadge?: string) => {
        const selected = isRowSelected(row);
        return (
            <tr
                key={rowKey}
                data-row-key={rowKey}
                onClick={() => {
                    if (selectionConfig.mode !== 'none') {
                        handleRowSelection(row);
                    } else {
                        onRowClick?.(row);
                    }
                }}
                className={`transition-all duration-150 ${
                    selected
                        ? 'bg-green-50 hover:bg-green-100 border-l-4 border-green-500'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                } ${selectionConfig.mode !== 'none' || onRowClick ? 'cursor-pointer' : ''}`}
            >
                {effectiveColumns.map((column, colIndex) => (
                    <td key={column.key} className={`px-6 py-4 whitespace-nowrap text-sm ${
                        selected ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                        {/* check icon in the first column if selected, plus the New badge of an unsaved row */}
                        {colIndex === 0 ? (
                            <div className="flex items-center space-x-2">
                                {selected && selectionConfig.mode !== 'none' && (
                                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                                )}
                                {sessionBadge ? (
                                    <RowBadge label={sessionBadge} />
                                ) : isHybridMode && (row as any).isPersisted === false && (
                                    <RowBadge />
                                )}
                                {creatingKey && catalogKeyOf(row, entityTypeName) === creatingKey && (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                )}
                                <span>{renderCellValue(row, column)}</span>
                            </div>
                        ) : (
                            renderCellValue(row, column)
                        )}
                    </td>
                ))}
                {rowActions.length > 0 && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                            {rowActions.map((action, actionIndex) => (
                                <React.Fragment key={actionIndex}>
                                    {action(row)}
                                </React.Fragment>
                            ))}
                        </div>
                    </td>
                )}
            </tr>
        );
    };

    return (
        <div className="w-full space-y-4">
            {/* Toolbar - changed: conditionally render based on showSearchBar prop */}
            {(showSearchBar || toolbarActions) && (
                <div className="flex items-center justify-between">
                    {showSearchBar && (
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Search..."
                                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                    )}
                    {toolbarActions && (
                        <div className={showSearchBar ? 'ml-4' : ''}>
                            {toolbarActions}
                        </div>
                    )}
                </div>
            )}

            {/* Selection Info Banner - changed: conditionally render based on showSelectionBanner prop */}
            {showSelectionBanner && selectionConfig.mode !== 'none' && internalSelection.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-blue-800">
                        {internalSelection.length} item{internalSelection.length !== 1 ? 's' : ''} selected
                        {selectionConfig.min && ` (min: ${selectionConfig.min})`}
                        {selectionConfig.max && ` (max: ${selectionConfig.max})`}
                    </span>
                    {selectionConfig.mode === 'multiple' && (!selectionConfig.min || selectionConfig.min === 0) && (
                        <button
                            onClick={() => {
                                setInternalSelection([]);
                                onSelectionChange?.([]);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                            Clear selection
                        </button>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {/* Table */}
            <div className="w-full overflow-x-auto panel bg-white/95 backdrop-blur">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <table className="w-full min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {/* changed: removed checkbox column header since we show check icon in row */}
                                {effectiveColumns.map(column => (
                                    <th
                                        key={column.key}
                                        scope="col"
                                        className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${
                                            column.sortable ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''
                                        }`}
                                        onClick={() => column.sortable && handleSort(column.key)}
                                    >
                                        <div className="flex items-center space-x-1">
                                            <span>{column.label}</span>
                                            {column.sortable && getSortIcon(column.key)}
                                        </div>
                                    </th>
                                ))}
                                {rowActions.length > 0 && (
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {section.pinned.length > 0 && (
                                <>
                                    <tr className="bg-amber-50/60">
                                        <td colSpan={columnCount} className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
                                            Created in this form
                                        </td>
                                    </tr>
                                    {section.pinned.map(pin => renderRow(pin.row, `pinned:${pin.key}`, pin.badge ?? 'New'))}
                                    {section.pageItems.length > 0 && (
                                        <tr className="bg-slate-50">
                                            <td colSpan={columnCount} className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                Search results
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                            {section.pinned.length === 0 && section.pageItems.length === 0 ? (
                                <tr>
                                    <td colSpan={columnCount} className="px-6 py-12 text-center text-gray-500">
                                        No results found
                                    </td>
                                </tr>
                            ) : (
                                uniqueRowKeys(section.pageItems.map((row, index) => tableRowKey(row, entityTypeName, index)))
                                    .map((rowKey, index) => renderRow(section.pageItems[index], rowKey))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination - changed: conditionally render based on totalCount vs pageSize */}
            {shouldShowPagination && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => handlePageChange(query.page - 1)}
                            disabled={isOnFirstPage}
                            className="btn-secondary disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => handlePageChange(query.page + 1)}
                            disabled={isOnLastPage}
                            className="btn-secondary disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{(query.page - 1) * query.pageSize + 1}</span> to{' '}
                                <span className="font-medium">{Math.min(query.page * query.pageSize, data.totalCount)}</span> of{' '}
                                <span className="font-medium">{data.totalCount}</span> results
                            </p>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handlePageChange(query.page - 1)}
                                disabled={isOnFirstPage}
                                className="btn-secondary disabled:opacity-50 flex items-center"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </button>
                            <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700">
                                Page {query.page} of {totalPagesDerived}
                            </span>
                            <button
                                onClick={() => handlePageChange(query.page + 1)}
                                disabled={isOnLastPage}
                                className="btn-secondary disabled:opacity-50 flex items-center"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

