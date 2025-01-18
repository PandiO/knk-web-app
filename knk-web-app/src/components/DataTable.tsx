import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical } from 'lucide-react';

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface ActionItem {
  label: string;
  onClick: (item: any) => void;
  icon?: React.ReactNode;
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  excludeColumns?: (keyof T)[];
  formatters?: Partial<Record<keyof T, (value: any) => React.ReactNode>>;
  headers?: Partial<Record<keyof T, string>>;
  actions?: ActionItem[];
}

export function DataTable<T extends Record<string, any>>({
  data,
  excludeColumns = [],
  formatters = {},
  headers = {},
  actions = [],
}: DataTableProps<T>) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!data.length) return null;

  // Filter out columns that should be excluded and handle circular references
  const getDisplayColumns = (item: T): string[] => {
    return Object.keys(item).filter(key => {
      // Exclude specified columns
      if (excludeColumns.includes(key as keyof T)) return false;

      const value = item[key];
      
      // Exclude array properties to prevent circular references
      if (Array.isArray(value)) return false;
      
      // Exclude complex objects without formatters
      if (typeof value === 'object' && value !== null && !formatters[key as keyof T]) {
        return false;
      }

      return true;
    });
  };

  const columns = getDisplayColumns(data[0]);

  const formatValue = (key: string, value: any): React.ReactNode => {
    // If there's a formatter for this key, use it
    if (formatters[key as keyof T]) {
      return formatters[key as keyof T]!(value);
    }

    // Handle null/undefined
    if (value === null || value === undefined) return '-';

    // Handle basic types
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    
    // Handle objects
    if (typeof value === 'object') {
      // If it's an object with a Name property, use that
      if (value && 'Name' in value) {
        return value.Name;
      }
      // For other objects, return a placeholder
      return '[Object]';
    }

    // Return primitive values as is
    return value;
  };

  const getHeaderText = (key: string): string => {
    if (headers[key as keyof T]) {
      return headers[key as keyof T] as string;
    }
    return key
      .split(/(?=[A-Z])|_/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getSortIcon = (column: string) => {
    if (sortState.column !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortState.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const compareValues = (a: any, b: any, direction: SortDirection = 'asc'): number => {
    // Handle null/undefined values
    if (a === null || a === undefined) return direction === 'asc' ? -1 : 1;
    if (b === null || b === undefined) return direction === 'asc' ? 1 : -1;

    // Handle different data types
    if (a instanceof Date && b instanceof Date) {
      return direction === 'asc' ? a.getTime() - b.getTime() : b.getTime() - a.getTime();
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return direction === 'asc' ? a - b : b - a;
    }

    // Handle objects with Name property
    if (typeof a === 'object' && a !== null && 'Name' in a) {
      a = a.Name;
    }
    if (typeof b === 'object' && b !== null && 'Name' in b) {
      b = b.Name;
    }

    // Convert to strings for comparison
    const strA = String(a).toLowerCase();
    const strB = String(b).toLowerCase();

    return direction === 'asc' ? 
      strA.localeCompare(strB) : 
      strB.localeCompare(strA);
  };

  function handleSort(column: string) {
    setSortState(prevState => {
      const newDirection: SortDirection = 
        prevState.column === column
          ? prevState.direction === 'asc'
            ? 'desc'
            : prevState.direction === 'desc'
              ? null
              : 'asc'
          : 'asc';
      
      return {
        column: newDirection ? column : null,
        direction: newDirection,
      };
    });
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortState.column || !sortState.direction) return 0;
    return compareValues(a[sortState.column], b[sortState.column], sortState.direction);
  });

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow-lg">
      <table className="w-full min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center space-x-1">
                  <span>{getHeaderText(column)}</span>
                  {getSortIcon(column)}
                </div>
              </th>
            ))}
            {actions.length > 0 && (
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((item, index) => (
            <tr
              key={index}
              className="hover:bg-gray-50 transition-colors relative group"
            >
              {columns.map((column) => (
                <td
                  key={column}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {formatValue(column, item[column])}
                </td>
              ))}
              {actions.length > 0 && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setActiveMenu(activeMenu === index ? null : index)}
                      className="invisible group-hover:visible p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </button>
                    {activeMenu === index && (
                      <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                        <div className="py-1" role="menu">
                          {actions.map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              onClick={() => {
                                action.onClick(item);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              role="menuitem"
                            >
                              {action.icon && <span>{action.icon}</span>}
                              <span>{action.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}