import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Loader2, ChevronDown, X } from 'lucide-react';

interface Instance {
  id: number;
  name: string;
}

interface SearchableDropdownProps {
  instances: Instance[];
  selectedId?: number;
  onSelect: (id: number | null) => void;
  onCreateNew: () => void;
  label: string;
  loading?: boolean;
  error?: string;
  required?: boolean;
}

export function SearchableDropdown({
  instances,
  selectedId,
  onSelect,
  onCreateNew,
  label,
  loading = false,
  error,
  required = false
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredInstances = instances.filter(instance =>
    instance.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedInstance = instances.find(instance => instance.id == selectedId);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredInstances.length ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredInstances.length
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex === filteredInstances.length) {
          onCreateNew();
        } else if (filteredInstances[highlightedIndex]) {
          onSelect(filteredInstances[highlightedIndex].id);
        }
        setIsOpen(false);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
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
          {loading ? (
            <div className="flex items-center text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : selectedInstance ? (
            <div className="flex items-center justify-between">
              <span>{selectedInstance.name} ({selectedInstance.id}) {selectedInstance.id == -1 && '(New)'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
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
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  ref={searchInputRef}
                />
              </div>
            </div>

            {filteredInstances.map((instance, index) => (
              <div
                key={instance.id ?? '/'}
                className={`
                  cursor-pointer select-none relative py-2 pl-3 pr-9
                  ${highlightedIndex === index ? 'bg-blue-600 text-white' : 'text-gray-900'}
                  ${index === 0 ? '' : 'border-t border-gray-200'}
                `}
                onClick={() => {
                  onSelect(instance.id);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="block truncate">
                  {instance.name} ({instance.id})
                </span>
              </div>
            ))}

            <button
              type="button"
              className={`
                w-full text-left relative py-2 pl-3 pr-9 flex items-center
                ${highlightedIndex === filteredInstances.length ? 'bg-blue-600 text-white' : 'text-blue-600'}
                hover:bg-blue-50 cursor-pointer
              `}
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(filteredInstances.length)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New {label}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}