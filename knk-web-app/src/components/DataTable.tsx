import * as React from 'react';
import { ArrowUpDown } from 'lucide-react';

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  excludeColumns?: (keyof T)[];
  formatters?: Partial<Record<keyof T, (value: any) => React.ReactNode>>;
  headers?: Partial<Record<keyof T, string>>;
}

export function DataTable<T extends Record<string, any>>({
  data,
  excludeColumns = [],
  formatters = {},
  headers = {},
}: DataTableProps<T>) {
  if (!data.length) return null;

  const columns = Object.keys(data[0]).filter(
    (key) => !excludeColumns.includes(key as keyof T)
  );

  const formatValue = (key: string, value: any): React.ReactNode => {
    if (formatters[key as keyof T]) {
      return formatters[key as keyof T]!(value);
    }

    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
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
              >
                <div className="flex items-center space-x-1">
                  <span>{getHeaderText(column)}</span>
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors">
              {columns.map((column) => (
                <td
                  key={column}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {formatValue(column, item[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}