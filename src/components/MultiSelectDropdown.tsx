import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check, ChevronDown, X } from 'lucide-react';

interface Instance {
  id: string;
  name: string;
}

interface MultiSelectDropdownProps {
  instances: Instance[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onCreateNew: () => void;
  label: string;
  error?: string;
  required?: boolean;
}

export function MultiSelectDropdown({
  instances,
  selectedIds,
  onSelect,
  onCreateNew,
  label,
  error,
  required = false
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredInstances = instances.filter(instance =>
    instance.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedInstances = instances.filter(instance =>
    selectedIds.includes(instance.id)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleInstance = (id: string) => {
    const newSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter(selectedId => selectedId !== id)
      : [...selectedIds, id];
    onSelect(newSelectedIds);
  };

  const handleSelectAll = () => {
    const newSelectedIds = filteredInstances.every(instance => 
      selectedIds.includes(instance.id)
    )
      ? selectedIds.filter(id => 
          !filteredInstances.some(instance => instance.id === id)
        )
      : Array.from(new Set([...selectedIds, ...filteredInstances.map(i => i.id)]));
    onSelect(newSelectedIds);
  };

  return (
    <div className="space-y-1" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            relative w-full bg-white border rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default
            ${error
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }
            focus:outline-none focus:ring-1 sm:text-sm
          `}
        >
          {selectedInstances.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedInstances.map(instance => (
                <span
                  key={instance.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {instance.name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInstance(instance.id);
                    }}
                    className="ml-1 text-blue-400 hover:text-blue-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">Select {label}</span>
          )}
          
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
            <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  ref={searchInputRef}
                />
              </div>
            </div>

            <div className="py-1">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between"
                onClick={handleSelectAll}
              >
                <span>{filteredInstances.every(instance => selectedIds.includes(instance.id))
                  ? 'Deselect All'
                  : 'Select All'
                }</span>
                {filteredInstances.every(instance => selectedIds.includes(instance.id)) && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </button>
            </div>

            <div className="border-t border-gray-200">
              {filteredInstances.map(instance => (
                <div
                  key={instance.id}
                  onClick={() => toggleInstance(instance.id)}
                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 flex items-center"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={selectedIds.includes(instance.id)}
                    onChange={() => {}}
                  />
                  <span className="ml-3 block truncate">
                    {instance.name}
                  </span>
                  {selectedIds.includes(instance.id) && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                      <Check className="h-4 w-4 text-blue-600" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New {label}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}