import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import { objectConfigs } from '../config/objectConfigs';

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const objectTypes = Object.entries(objectConfigs).map(([type, config]) => ({
    id: type,
    label: config.label,
    icon: config.icon,
    route: `/create/${type}`
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % objectTypes.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + objectTypes.length) % objectTypes.length);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          navigate(objectTypes[selectedIndex].route);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900" onClick={() => {
                navigate('/');
                setSelectedIndex(-1);
              }}>Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="Create a new object"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create New
              </button>

              {isOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                  role="menu"
                  onKeyDown={handleKeyDown}
                  tabIndex={-1}
                >
                  <div className="py-1">
                    {objectTypes.map((type, index) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          navigate(type.route);
                          setIsOpen(false);
                        }}
                        className={`
                          w-full text-left px-4 py-2 text-sm flex items-center justify-between
                          ${selectedIndex === index
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                        role="menuitem"
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="flex items-center">
                          <span className="mr-3 text-gray-400">{type.icon}</span>
                          {type.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}