import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { PagedQueryDto, PagedResultDto } from '../../utils/domain/dto/common/PagedQuery';
import { getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { logging } from '../../utils';
import { ColumnDefinition } from '../../types/common';

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
    columns: ColumnDefinition<T>[];
    
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
}

export function PagedEntityTable<T extends Record<string, any>>({
    entityTypeName,
    columns,
    initialQuery = {},
    onRowClick,
    rowActions = [],
    toolbarActions,
    selectionConfig = { mode: 'none' },
    selectedItems = [],
    onSelectionChange,
    showSearchBar = true,
    showSelectionBanner = true
}: PagedEntityTableProps<T>) {
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

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== query.searchTerm) {
                setQuery(prev => ({ ...prev, searchTerm: searchInput, page: 1 }));
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch data when query changes
    useEffect(() => {
        fetchData();
    }, [query, entityTypeName]);

    // Sync internal selection with prop changes (only if actually different)
    useEffect(() => {
        const isDifferent = selectedItems.length !== internalSelection.length ||
            selectedItems.some(item => !internalSelection.some(sel => sel.id === item.id));
        
        if (isDifferent) {
            setInternalSelection(selectedItems);
        }
    }, [selectedItems]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const searchFn = getSearchFunctionForEntity(entityTypeName);
            const result = await searchFn(query);
            setData(result);
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Failed to load data');
            logging.errorHandler.next(`ErrorMessage.${entityTypeName}.LoadFailed`);
        } finally {
            setLoading(false);
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

    const renderCellValue = (row: T, column: ColumnDefinition<T>) => {
        if (column.render) {
            return column.render(row);
        }

        const value = row[column.key];

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

        if (typeof value === 'object' && value.Name) {
            return value.Name;
        }

        return String(value);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= data.totalPages) {
            setQuery(prev => ({ ...prev, page: newPage }));
        }
    };

    // added: check if row is selected
    const isRowSelected = (row: T): boolean => {
        return internalSelection.some(item => item.id === row.id);
    };

    // added: handle row selection
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
                // Deselect
                newSelection = internalSelection.filter(item => item.id !== row.id);
                
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

    // added: handle select all checkbox
    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (selectionConfig.mode !== 'multiple') return;

        if (event.target.checked) {
            // Select all visible items (respecting max)
            const itemsToSelect = selectionConfig.max
                ? data.items.slice(0, selectionConfig.max)
                : data.items;
            setInternalSelection(itemsToSelect);
            onSelectionChange?.(itemsToSelect);
        } else {
            // Check if we can deselect all (min constraint)
            if (!selectionConfig.min || selectionConfig.min === 0) {
                setInternalSelection([]);
                onSelectionChange?.([]);
            }
        }
    };

    const allVisibleSelected = data.items.length > 0 && 
        data.items.every(row => isRowSelected(row));

    // added: determine if pagination should be shown
    const shouldShowPagination = !loading && data.items.length > 0 && data.totalCount > query.pageSize;

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
                                {columns.map(column => (
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
                            {data.items.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + (rowActions.length > 0 ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                                        No results found
                                    </td>
                                </tr>
                            ) : (
                                data.items.map((row, index) => {
                                    const selected = isRowSelected(row);
                                    return (
                                        <tr
                                            key={index}
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
                                            {columns.map((column, colIndex) => (
                                                <td key={column.key} className={`px-6 py-4 whitespace-nowrap text-sm ${
                                                    selected ? 'text-gray-900 font-medium' : 'text-gray-500'
                                                }`}>
                                                    {/* changed: add check icon to first column if selected */}
                                                    {colIndex === 0 && selected && selectionConfig.mode !== 'none' ? (
                                                        <div className="flex items-center space-x-2">
                                                            <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
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
                                })
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
                            disabled={query.page === 1}
                            className="btn-secondary disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => handlePageChange(query.page + 1)}
                            disabled={query.page >= data.totalPages}
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
                                disabled={query.page === 1}
                                className="btn-secondary disabled:opacity-50 flex items-center"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </button>
                            <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700">
                                Page {query.page} of {data.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(query.page + 1)}
                                disabled={query.page >= data.totalPages}
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
