import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, ChevronRight, Home, Table2, Building2, Settings2 } from 'lucide-react';
import { objectConfigs } from '../config/objectConfigs';

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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
    <nav className="panel fixed w-full top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center">
                <img
                  src="https://www.dropbox.com/scl/fi/dshx4j5951wsc0dvxvk22/favicon.png?rlkey=te7efq8ukvzy8mx6uj654h54h&raw=1"
                  alt="Logo"
                  className="h-10 w-10 mr-3 hover:opacity-90 transition-opacity"
                />
              </Link>
              <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
            </div>
            <div className="hidden sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === '/'
                    ? 'border-b-2 border-primary text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
              <Link
                to="/dashboard"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === '/dashboard'
                    ? 'border-b-2 border-primary text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Table2 className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/structure-overview"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === '/structure-overview'
                    ? 'border-b-2 border-primary text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Structures
              </Link>
              <Link
                to="/configurations/structure"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === '/configurations/structure'
                    ? 'border-b-2 border-primary text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configurations
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-primary"
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