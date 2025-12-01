import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PagedQueryDto, PagedResultDto } from '../../utils/domain/dto/common/PagedQuery';
import { getSearchFunctionForEntity } from '../../utils/entityApiMapping';
import { logging } from '../../utils';

export interface ColumnDefinition<T> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (row: T) => React.ReactNode;
}

export interface PagedEntityTableProps<T> {
    entityTypeName: string;
    columns: ColumnDefinition<T>[];
    initialQuery?: Partial<PagedQueryDto>;
    onRowClick?: (row: T) => void;
    rowActions?: Array<(row: T) => React.ReactNode>;
    toolbarActions?: React.ReactNode;
}

export function PagedEntityTable<T extends Record<string, any>>({
    entityTypeName,
    columns,
    initialQuery = {},
    onRowClick,
    rowActions = [],
    toolbarActions
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

    return (
        <div className="w-full space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
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
                {toolbarActions && (
                    <div className="ml-4">
                        {toolbarActions}
                    </div>
                )}
            </div>

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
                                data.items.map((row, index) => (
                                    <tr
                                        key={index}
                                        onClick={() => onRowClick?.(row)}
                                        className={`hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                    >
                                        {columns.map(column => (
                                            <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {renderCellValue(row, column)}
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
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {!loading && data.items.length > 0 && (
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
