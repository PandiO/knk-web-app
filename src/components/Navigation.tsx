import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, ChevronRight, Home, Table2, FileText, Layout, LayoutTemplate, LogOut, UserCircle2, Settings, Users, Menu, X, Swords } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStaffAccess } from '../hooks/useStaffAccess';

// added: explicit types for object types prop
type ObjectType = { id: string; label: string; icon: React.ReactNode; createRoute: string };
type Props = { objectTypes: ObjectType[] };

type NavLink = { to: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean; staffOnly?: boolean };

// One list for every size: the inline bar (labels from 2xl, icons only from lg) and the
// menu button's panel below lg - the single row used to overflow and push the last links
// and the account/Create buttons out of view on narrower windows.
const NAV_LINKS: NavLink[] = [
  { to: '/', label: 'Home', Icon: Home, exact: true },
  { to: '/dashboard', label: 'Dashboard', Icon: Table2, exact: true },
  { to: '/forms', label: 'Forms', Icon: FileText },
  { to: '/admin/form-configurations', label: 'Form Builder', Icon: Layout },
  { to: '/admin/display-configurations', label: 'Display Builder', Icon: LayoutTemplate },
  { to: '/admin/game-settings', label: 'Game Settings', Icon: Settings },
  // Siege Phase 3 (docs/specs/siege-minigame/IMPLEMENTATION_PLAN.md): global siege tunables
  { to: '/admin/siege-configuration', label: 'Siege Settings', Icon: Swords },
  { to: '/admin/users', label: 'Moderation', Icon: Users, exact: true, staffOnly: true },
];

// changed: accept props object instead of raw array parameter
export function Navigation({ objectTypes }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isLoading } = useAuth();
  const { isStaff } = useStaffAccess();
  const navLinks = NAV_LINKS.filter(link => !link.staffOnly || isStaff);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setIsNavMenuOpen(false);
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
          navigate(objectTypes[selectedIndex].createRoute);
          navigate(objectTypes[selectedIndex].createRoute);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Close the small-screen menu after navigating.
  useEffect(() => {
    setIsNavMenuOpen(false);
  }, [location.pathname]);

  const isActive = (link: NavLink) =>
    link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (err) {
      // Error is already handled in useAuth hook
      navigate('/auth/login');
    }
  };

  return (
    <nav className="panel fixed w-full top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex min-w-0 items-center space-x-4 2xl:space-x-8">
            {/* Below lg the links live in this menu instead of the bar. */}
            <div className="relative lg:hidden" ref={navMenuRef}>
              <button
                onClick={() => setIsNavMenuOpen(open => !open)}
                className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={isNavMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isNavMenuOpen}
              >
                {isNavMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {isNavMenuOpen && (
                <div
                  className="absolute left-0 mt-2 w-60 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                  role="menu"
                >
                  {navLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      role="menuitem"
                      className={`flex items-center px-4 py-2 text-sm ${
                        isActive(link)
                          ? 'bg-slate-100 font-medium text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <link.Icon className="h-4 w-4 mr-3 text-slate-500" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center">
                <img
                  src="https://www.dropbox.com/scl/fi/dshx4j5951wsc0dvxvk22/favicon.png?rlkey=te7efq8ukvzy8mx6uj654h54h&raw=1"
                  alt="Logo"
                  className="h-10 w-10 mr-3 hover:opacity-90 transition-opacity"
                />
              </Link>
              <h1 className="hidden sm:block text-xl font-semibold text-slate-900">Dashboard</h1>
            </div>
            <div className="hidden lg:flex lg:space-x-1 2xl:space-x-6">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  title={link.label}
                  aria-label={link.label}
                  className={`inline-flex items-center whitespace-nowrap px-2 pt-1 text-sm font-medium 2xl:px-1 ${
                    isActive(link)
                      ? 'border-b-2 border-primary text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <link.Icon className="h-4 w-4 2xl:mr-2" />
                  <span className="hidden 2xl:inline">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center space-x-4">
            {/* Account Menu Dropdown */}
            <div className="relative" ref={accountMenuRef}>
              <button
                onMouseEnter={() => setIsAccountMenuOpen(true)}
                onClick={() => {
                  navigate('/account');
                  setIsAccountMenuOpen(false);
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                title="Account"
              >
                <UserCircle2 className="h-5 w-5" />
              </button>

              {isAccountMenuOpen && (
                <div
                  onMouseLeave={() => setIsAccountMenuOpen(false)}
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  role="menu"
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate('/account');
                        setIsAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      role="menuitem"
                    >
                      <UserCircle2 className="h-4 w-4 mr-3" />
                      Account Settings
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsAccountMenuOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center disabled:opacity-50"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-primary inline-flex items-center whitespace-nowrap"
                title="Create a new object"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Create New</span>
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
                          // changed: Navigate to forms with autoOpenDefaultForm=true for Use Case 4
                          navigate(`/forms/${type.id}?autoOpen=true`);
                          // changed: Navigate to forms with autoOpenDefaultForm=true for Use Case 4
                          navigate(`/forms/${type.id}?autoOpen=true`);
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